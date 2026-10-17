
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
const SHIRT=['#3dd68c','#ff6b3d','#4aa3ff','#ffc94a','#c9c3d6','#ff7ad9','#29e6d6'];

const barrels=[],courts=[];
const cells=[],buildings=[],parks=[],lots=[],blockType=[],palms=[],umbrellas=[],pools=[],cranes=[];
const PASTEL=['#e8b4c8','#b4d8e8','#f1e3a8','#c8e8b4','#e8c8a8','#d0c4f0'];
const CONT=['#b8432f','#2f6fb8','#d68a2f','#3d8a52','#7b6bff','#9d97ad'];
function district(bi,bj){if(bj===N-1)return'beach';if(bi<=1)return'industrial';if(bi>=8&&bj<=5)return'airport';if(bi>=6&&bj<=3)return'suburb';if(bi>=6&&bj>=4)return'hood';if((bi===3||bi===4)&&bj<=1)return'park';if(bi>=2&&bi<=5&&bj>=2&&bj<=5)return'downtown';return'midtown'}
const AREA={hills:['Palmetto Hills','Mountain roads, the observatory and the sign'],airport:['Palmetto International','Fighter jets on the runway'],hood:['Low Palms','Kings territory. Watch your back'],beach:['Sunset Beach','Sand, surf and palm trees'],industrial:['Rustwater Docks','Viper gang territory. Watch your back'],suburb:['Palm Heights','Quiet streets, pools, lawns'],park:['Lagoon Park','Trees and the lagoon'],downtown:['Downtown Neon','Skyscrapers and nightlife'],midtown:['Midtown','Shops and apartments']};
// blocks owned by the landmarks section (see LANDMARKS): left empty here, built there
const LANDBLK={'2,4':'plaza','4,7':'skate','7,7':'pit','0,7':'marina','0,8':'marina'};
{const r=seeded(4242);
 const mk=(list,o)=>{const[roof,trim]=o.pal||ROOFS[Math.floor(r()*ROOFS.length)];const b=Object.assign({roof,trim,vent:null,sign:false,ladder:null},o);b.sides=[shade(b.roof,.55),shade(b.roof,.8),shade(b.roof,.45),shade(b.roof,.7)];list.push(b);buildings.push(b);return b};
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
    if(bi===8&&bj===0)mk(list,{x:x0+30,y:y0+30,w:s-60,h:120,H:40,kind:'glass'});
    if(bi===8&&(bj===1||bj===3))mk(list,{x:x0+30,y:y0+40,w:s-60,h:s-90,H:56,kind:'warehouse',pal:['#5a6070','#ffc94a']});
    if(bi===8&&bj===5)mk(list,{x:x0+120,y:y0+120,w:60,h:60,H:170,kind:'tower'});
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
  const tall=dist==='downtown',m=22,ix=x0+m,iy=y0+m,is=s-2*m,g=12,lay=Math.floor(r()*4);
  const L=lay===0?[[0,0,1,1]]:lay===1?[[0,0,.5,1],[.5,0,.5,1]]:lay===2?[[0,0,1,.5],[0,.5,1,.5]]:[[0,0,.5,.5],[.5,0,.5,.5],[0,.5,.5,.5],[.5,.5,.5,.5]];
  for(const[fx,fy,fw,fh]of L){
    const x=ix+fx*is+(fx>0?g/2:0),y=iy+fy*is+(fy>0?g/2:0);
    const w=fw*is-(fx>0?g/2:0)-(fx+fw<1?g/2:0),h=fh*is-(fy>0?g/2:0)-(fy+fh<1?g/2:0);
    const H=Math.round(tall?(90+r()*230)*(1+Math.max(0,2.5-Math.hypot(bi-3.5,bj-3.5))*.3):(44+r()*80));
    const b=mk(list,{x,y,w,h,H,kind:tall?'glass':'tower',vent:r()<.7?[r()*.5+.1,r()*.5+.1]:null,sign:r()<.25});
    if(Math.abs(y+h-(y0+s-22))<1&&r()<(tall?.4:.55))b.ladder=1;
  }
 }}
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
  if(s.kind==='bowl'){const d=Math.hypot(dx,dy);return d>=s.r?null:s.depth*(1+Math.cos(d/s.r*Math.PI))*.5}
  return null}
function addShape(s){TERRAIN.push(s);if(s.kind==='ramp')RAMPS.push(s);
  let bb;
  if(s.kind==='mound'||s.kind==='bowl')bb=[s.x-s.r,s.y-s.r,s.x+s.r,s.y+s.r];
  else if(s.kind==='plateau')bb=[s.x-s.w/2-s.slope,s.y-s.d/2-s.slope,s.x+s.w/2+s.slope,s.y+s.d/2+s.slope];
  else{const c=Math.cos(s.a),n=Math.sin(s.a),lx=-n*s.w/2,ly=c*s.w/2,ax=s.x+c*s.len,ay=s.y+n*s.len,
    x0=Math.min(s.x-lx,s.x+lx,ax-lx,ax+lx),y0=Math.min(s.y-ly,s.y+ly,ay-ly,ay+ly);bb=[x0,y0,s.x+ax-x0,s.y+ay-y0]}
  const gw=HM.gw,i0=Math.max(0,(Math.floor((bb[0]-HM.x0)/HM.cell))-1),j0=Math.max(0,(Math.floor((bb[1]-HM.y0)/HM.cell))-1),
    i1=Math.min(HM.gw-1,Math.ceil((bb[2]-HM.x0)/HM.cell)+1),j1=Math.min(HM.gh-1,Math.ceil((bb[3]-HM.y0)/HM.cell)+1),sunken=s.kind==='bowl';
  s.box=[i0,j0,i1,j1];
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const h=shapeHz(HM.x0+i*HM.cell,HM.y0+j*HM.cell,s);if(h===null)continue;
    const k=j*gw+i;HM.a[k]=sunken?HM.a[k]-h:Math.max(HM.a[k],h)}} // a bowl digs into the ground under it, so it works on a raised deck
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
  // observatory door-less car park edge and campsite
  const cy=-430,ch=hillBase(430,cy);
  add(new THREE.CylinderGeometry(7,7,1.4,10),new THREE.MeshLambertMaterial({color:'#4a4650'}),430,ch+.7,cy);
  glowAt(430,ch+6,cy,22,22,'rgba(255,150,60,1)');
  for(const[x,y,a]of[[410,-446,.4],[440,-410,1.1],[452,-448,2.3]])add(new THREE.ConeGeometry(16,20,4),tentM[Math.floor(a*3)%3],x,ch+10,y,a*Math.PI);
  for(const[x,y]of[[400,-418],[456,-436]]){add(new THREE.BoxGeometry(16,1,8),wood,x,ch+6,y);add(new THREE.BoxGeometry(14,4,1),wood,x,ch+2,y)}
  // radio tower on the second peak: a mast with a red beacon
  const T0=T.x,T1=T.y,th=hillBase(T0,T1);
  add(new THREE.CylinderGeometry(1.2,4,150,6),steel,T0,th+75,T1);add(new THREE.BoxGeometry(14,6,14),steel,T0,th+3,T1);
  add(new THREE.SphereGeometry(2.2,8,6),redM,T0,th+152,T1);glowAt(T0,th+152,T1,30,30,'rgba(255,45,85,1)');
  const wat=new THREE.Mesh(new THREE.CircleGeometry(LAKE.r+4,48),new THREE.MeshLambertMaterial({color:'#1a5a70',emissive:'#0a3346'}));wat.rotation.x=-Math.PI/2;wat.position.set(LAKE.x,LAKE.water,LAKE.y);out.push(wat);
  return out}
// instanced scatter on the hills: pines and scrub on gentle ground, rocks on steep faces, palms on the terraces, trail posts. Clear of roads, pads and the lake.
function propMeshes(){
  const rq=seeded(88),RP=[];for(const r of HILL_ROADS)for(const[x,y]of roadSamples(r,12))RP.push([x,y,r.w/2]);
  const free=(x,y,clear)=>{if(y>-60||x<0||x>W+250||Math.hypot(x-LAKE.x,y-LAKE.y)<LAKE.r+30)return false;
    for(const p of PADS)if(Math.abs(x-p.x)<p.hw+12&&Math.abs(y-p.y)<p.hd+12)return false;
    for(const q of RP)if(Math.hypot(x-q[0],y-q[1])<q[2]+clear)return false;return true};
  const pine=[],scrub=[],rock=[];
  for(let n=0;n<5000;n++){const x=rq()*(W+250),y=-2380+rq()*2320;if(!free(x,y,14))continue;
    const[gx,gy]=groundN(x,y),sl=Math.hypot(gx,gy),h=groundZ(x,y);
    if(sl>.35&&rock.length<320&&rq()<.6)rock.push([x,y,h,rq()]);
    else if(sl<.5&&h>4&&pine.length<800&&rq()<.4)pine.push([x,y,h,rq()]);
    else if(scrub.length<1000&&rq()<.6)scrub.push([x,y,h,rq()])}
  const fl=m=>{m.frustumCulled=false;return m};
  const pT=fl(new THREE.InstancedMesh(new THREE.CylinderGeometry(.6,.9,7,5),new THREE.MeshLambertMaterial({color:'#4a3426'}),pine.length)),
    pL=fl(new THREE.InstancedMesh(new THREE.ConeGeometry(6,18,6),new THREE.MeshLambertMaterial({color:'#2f5a3a',flatShading:true}),pine.length)),
    sc=fl(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#5e7a3a',flatShading:true}),scrub.length)),
    rk=fl(new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#6e655c',flatShading:true}),rock.length));
  pine.forEach(([x,y,h,r],i)=>{const s=.7+r*.5;inst(pT,i,x,h+3.5*s,y,0,s,s,s);inst(pL,i,x,h+16*s*.5+3.5*s,y,r*6.28,s,s,s)});
  scrub.forEach(([x,y,h,r],i)=>{const s=2+r*2.5;inst(sc,i,x,h+s*.3,y,r*6.28,s,s*.6,s)});
  rock.forEach(([x,y,h,r],i)=>{const s=1.5+r*3;inst(rk,i,x,h+s*.3,y,r*6.28,s,s*.7,s)});
  // palms: two per mansion, trunk and crown
  const palms=MANSION_SITES.flatMap(([x,y])=>{const h=hillBase(x,y);return[[x-26,y+12,h],[x+26,y+12,h]]});
  const pt=fl(new THREE.InstancedMesh(new THREE.CylinderGeometry(.5,.8,12,5),new THREE.MeshLambertMaterial({color:'#6b4a2e'}),palms.length)),
    pc=fl(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#2f7a48',flatShading:true}),palms.length));
  palms.forEach(([x,y,h],i)=>{inst(pt,i,x,h+6,y);inst(pc,i,x,h+13,y,i,5,1.6,5)});
  // trail posts every 45 units along the dirt trail
  const tp=HILL_ROADS.find(r=>r.dirt),tS=roadSamples(tp,45),tpost=fl(new THREE.InstancedMesh(new THREE.BoxGeometry(.6,3,.6),new THREE.MeshLambertMaterial({color:'#7a5a3c'}),tS.length));
  tS.forEach(([x,y],i)=>inst(tpost,i,x,groundZ(x,y)+1.5,y));
  return[pT,pL,sc,rk,pt,pc,tpost]}
lakeShape();for(const r of HILL_ROADS)flattenRoad(r);placeLayout();rebuildRaised();
if(DBG)Object.defineProperties(DBG,{hillSpots:{get:()=>HILL_SPOTS.map(s=>s.name)},hillRoads:{get:()=>HILL_ROADS.length},roadGrades:{get:()=>HILL_ROADS.map(r=>[r.name,Math.round(r.len),+r.grade.toFixed(3)])}});
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
// one mesh per 400 units of y: vertex colours by slope (dry grass, rock on steep faces, bare earth on the flat verge), normals from the heightmap so the bands join without seams
const HC={verge:new THREE.Color('#4a4a36'),g1:new THREE.Color('#5b8a3a'),g2:new THREE.Color('#9aa04c'),r1:new THREE.Color('#625c55'),r2:new THREE.Color('#827a6e')},HCOL=new THREE.Color(),HCOL2=new THREE.Color();
function hillMeshes(){
  const det=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#c8c8c8';g.fillRect(0,0,w,h);grit(g,w,h,9000,31,.12)});det.wrapS=det.wrapT=THREE.RepeatWrapping;
  const nx=Math.floor((W+300-HM.x0)/HM.cell)+1,hz=(i,j)=>HM.a[clamp(j,0,HM.gh-1)*HM.gw+clamp(i,0,HM.gw-1)],out=[];
  for(let j0=20;j0<260;j0+=40){const j1=Math.min(260,j0+40),nr=j1-j0+1,pos=[],nor=[],col=[],uv=[],ix=[];
    for(let j=j0;j<=j1;j++)for(let i=0;i<nx;i++){const x=HM.x0+i*HM.cell,z=HM.y0+j*HM.cell,h=hz(i,j);
      const gx=(hz(i+1,j)-hz(i-1,j))/(2*HM.cell),gz=(hz(i,j+1)-hz(i,j-1))/(2*HM.cell),s=Math.hypot(gx,gz),ln=Math.hypot(gx,1,gz);
      pos.push(x,h,z);nor.push(-gx/ln,1/ln,-gz/ln);uv.push(x/120,z/120);
      if(h<1.5)HCOL.copy(HC.verge);else{HCOL.lerpColors(HC.g1,HC.g2,clamp(h/360,0,1));HCOL2.lerpColors(HC.r1,HC.r2,vnoise(x/90,z/90));
        HCOL.lerp(HCOL2,clamp((s-.42)/.28,0,1)*clamp((s-.42)/.28,0,1)*(3-2*clamp((s-.42)/.28,0,1)))}
      col.push(HCOL.r,HCOL.g,HCOL.b)}
    for(let j=0;j<nr-1;j++)for(let i=0;i<nx-1;i++){const a=j*nx+i,b=a+1,c=a+nx,d=c+1;ix.push(a,c,b,b,c,d)}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);
    out.push(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,map:det})))}
  return out.concat(roadMeshes(),placeMeshes(),propMeshes(),[hikeMesh()])}

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

// minimap layer for the hills, drawn once: shaded contours, roads, the lake and the spot icons. drawMini blits it.
function buildHillMini(MS,MO){
  const X0=-MO,Y0=HILL.edge-MO,cv=document.createElement('canvas');cv.width=Math.ceil((W+2*MO)/MS);cv.height=Math.ceil(-Y0/MS);cv.ox=X0;cv.oy=Y0;
  const g=cv.getContext('2d'),t=(x,y)=>[(x-X0)/MS,(y-Y0)/MS],i0=Math.max(0,Math.round((X0-HM.x0)/HM.cell)),i1=Math.min(HM.gw-1,Math.round((X0+cv.width*MS-HM.x0)/HM.cell)),
    j0=Math.max(0,Math.round((Y0-HM.y0)/HM.cell)),j1=Math.min(HM.gh-1,Math.round((0-HM.y0)/HM.cell)-1),ni=i1-i0+1,nj=j1-j0+1,hh=(i,j)=>HM.a[clamp(j,0,HM.gh-1)*HM.gw+clamp(i,0,HM.gw-1)];
  g.fillStyle='#0b2a3d';g.fillRect(0,0,cv.width,cv.height);
  const img=new ImageData(ni,nj),d=img.data;
  for(let j=0;j<nj;j++)for(let i=0;i<ni;i++){const I=i0+i,J=j0+j,h=hh(I,J),gx=(hh(I+1,J)-hh(I-1,J))/20,gz=(hh(I,J+1)-hh(I,J-1))/20,
    lit=clamp((gx*.5+gz*.5+.7)/Math.hypot(gx,1,gz)/Math.hypot(.5,.7,.5),.3,1),k=(j*ni+i)*4;
    const f=clamp(h/300,0,1),c=h<1?[74,74,54]:[63+(122-63)*f,90+(112-90)*f,46+(74-46)*f],
      line=h>=1&&(Math.floor(h/50)!==Math.floor(hh(I+1,J)/50)||Math.floor(h/50)!==Math.floor(hh(I,J+1)/50))?.7:1;
    d[k]=c[0]*lit*line;d[k+1]=c[1]*lit*line;d[k+2]=c[2]*lit*line;d[k+3]=255}
  const tmp=document.createElement('canvas');tmp.width=ni;tmp.height=nj;tmp.getContext('2d').putImageData(img,0,0);
  g.imageSmoothingEnabled=true;const[px,py]=t(HM.x0+i0*HM.cell,HM.y0+j0*HM.cell);g.drawImage(tmp,px,py,ni*HM.cell/MS,nj*HM.cell/MS);
  for(const r of HILL_ROADS){const S=roadSamples(r,6);g.beginPath();S.forEach(([x,y],k)=>{const[qx,qy]=t(x,y);k?g.lineTo(qx,qy):g.moveTo(qx,qy)});
    g.strokeStyle=r.dirt?'#8a6a44':'#3a3848';g.lineWidth=Math.max(1.2,r.w/MS);g.lineJoin='round';g.stroke()}
  const[lx,ly]=t(LAKE.x,LAKE.y);g.fillStyle='#1d6a8a';g.beginPath();g.arc(lx,ly,LAKE.r/MS,0,TAU);g.fill();
  g.font='700 12px "Chakra Petch",sans-serif';g.textAlign='center';g.textBaseline='middle';
  for(const s of HILL_SPOTS){const[qx,qy]=t(s.x,s.y);g.fillStyle='#0b0814';g.beginPath();g.arc(qx,qy,8,0,TAU);g.fill();g.strokeStyle='#ffc94a';g.lineWidth=1.5;g.stroke();g.fillStyle='#ffc94a';g.fillText(s.icon,qx,qy+1)}
  return cv}
// fog thins in the hills so the city lights show from the overlook at night
let fogHill=false;
function hillFog(){const on=me.y<0;if(on===fogHill)return;fogHill=on;scene.fog.density=on?.00026:.00105}

// ---------- landmarks ----------
// Hand-placed places on the blocks in LANDBLK. Their buildings are solid boxes (kind 'lm') with a mesh in landmarkMeshes() (models section).
// Shapes go through addShape, so the heightmap, steps and ramps need no extra code.
const LMS=[],LMA={spray:null,boats:null};
// name shown on entry (AREA banner), footprint for the minimap and the debug list
const LANDMARKS=[{name:'The Pit',sub:'Walled arena, catwalk and floodlights',x:3200,y:3200,w:320,h:320,ic:'X'},{name:'Palmetto Plaza',sub:'Fountain, stage and a terrace',x:1000,y:1880,w:320,h:320,ic:'F'},{name:'Sunset Pier',sub:'Boardwalk, Ferris wheel and the coaster frame',x:1900,y:4520,w:400,h:260,ic:'W'},{name:'Skate Park',sub:'Bowls, graffiti walls and rails',x:1880,y:3200,w:320,h:320,ic:'Z'},{name:'Rustwater Marina',sub:'Quay, boats and containers',x:120,y:3200,w:320,h:760,ic:'M'}];
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
addShape({kind:'ramp',x:1160,y:2010,a:-Math.PI/2,len:40,w:24,h:12}); // drive up onto the terrace; lip at y 1970
addShape({kind:'plateau',x:1240,y:2140,w:110,d:56,h:4,slope:2});    // stage
// Rustwater Marina, blocks (0,7) and (0,8): a container yard on (0,7); on (0,8) a basin with boats, a quay on its east side with containers and a crane, and a stunt ramp off the quay over the basin onto a container row on the west bank.
for(let i=0;i<6;i++){lmSolid(140+i*44,3236,40,18,8,i%2?'cA':'cB');lmSolid(140+i*44,3290,40,18,i<3?16:8,i%2?'cC':'cD')}
lmSolid(140,3350,40,18,8,'cC');lmSolid(184,3350,40,18,8,'cA');
lmSolid(170,3648,126,4,3.2,'wall');lmSolid(170,3948,126,4,3.2,'wall');   // basin bulkheads, north and south
lmSolid(166,3648,4,304,3.2,'wall');lmSolid(296,3648,4,304,3.2,'wall');    // west bank and quay edge
addShape({kind:'plateau',x:370,y:3800,w:140,d:320,h:3,slope:2});          // quay
addShape({kind:'ramp',x:345,y:3800,a:Math.PI,len:40,w:30,h:12});         // off the quay, west over the basin
for(const[y,c]of[[3660,'cA'],[3682,'cB'],[3704,'cC'],[3960-18-80,'cD']])lmSolid(372,y,40,18,8,c); // quay containers, north part
lmSolid(126,3664,36,18,8,'cB');lmSolid(126,3686,36,18,8,'cA');lmSolid(126,3822,36,18,8,'cC');lmSolid(126,3844,36,18,16,'cD');lmSolid(126,3866,36,18,8,'cB'); // west bank row
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
function alleyCut(bi,bj){const cell=cells[bj*N+bi];let b=null;for(const q of cell)if((q.kind==='glass'||q.kind==='tower')&&!q.ladder&&(!b||q.w*q.h>b.w*b.h))b=q;if(!b)return;
  const gap=30,hw=(b.w-gap)/2,ax=b.x+hw;cell.splice(cell.indexOf(b),1);buildings.splice(buildings.indexOf(b),1);
  for(const x of[b.x,ax+gap]){const h={...b,x,w:hw,vent:null,sign:false,ladder:null};cell.push(h);buildings.push(h)}
  ALLEYS.push({x:ax,y:b.y,h:b.h});
  lmSolid(ax-34,b.y-14,12,8,4,'metal'); // dumpster beside the north mouth, off the car path
}
for(const[bi,bj]of[[2,3],[5,4],[3,2]])alleyCut(bi,bj);
if(DBG)Object.defineProperties(DBG,{alleys:{get:()=>ALLEYS.map(a=>[a.x,a.y,a.h])}});
// Sunset Pier, block row bj=9: a boardwalk on the sea side of the road (y 4524 to 4568) and the pier south from its middle to the world edge (y 4780). Deck at 4.
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
  {id:'sniper',name:'Sniper rifle',price:1800,cd:1.1,dmg:BAL.wdmg.sniper,spread:0,pellets:1,speed:1900,life:1,ammoAmt:20,ammoPrice:150,desc:'One shot, one KO. Hold right-click (or press Z) to scope.'},
  {id:'rpg',name:'RPG',price:1200,cd:1.1,dmg:0,spread:.01,pellets:1,rocket:true,ammoAmt:5,ammoPrice:300,desc:'Rockets that explode on impact. Mind the blast.'},
  {id:'homing',name:'Homing launcher',price:2500,cd:1.6,dmg:0,spread:0,pellets:1,rocket:true,homing:true,ammoAmt:4,ammoPrice:500,desc:'Locks onto players in cars (or any vehicle ahead of you). Hard to shake off.'},
  {id:'sticky',name:'Sticky bombs',price:1500,cd:.45,dmg:0,spread:0,pellets:1,throw:true,ammoAmt:5,ammoPrice:400,desc:'Throw them. They stick to cars, walls and the ground. Press G to detonate.'},
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
prop(gunInt,40,40,180,18,14,'#3a3348');prop(gunInt,0,0,260,10,44,'#2a2333');prop(gunInt,0,60,10,100,36,'#2a2333');prop(gunInt,250,60,10,100,36,'#2a2333');
spot(gunInt,130,80,'shop','Browse weapons');
const club=mkRoom('club','Velvet Palms',440,330,'#24102a',1);
prop(club,110,18,220,62,6,'#3a1840');prop(club,18,110,26,150,16,'#3b2416');prop(club,370,150,50,40,14,'#151022');
for(const[x,y]of[[70,290],[380,280],[90,60],[360,60]])prop(club,x,y,18,18,10,'#2c1a33');
spot(club,220,100,'tip','Tip the dancers ($10)');prop(club,350,300,72,18,9,'#6a1a52');spot(club,386,262,'vip','Private dance in the VIP booth ($100)');spot(club,62,185,'drink','Buy a drink ($15, +25 health)');
const store=mkRoom('store','Snack & Go',240,180,'#1c2622',2);
prop(store,30,40,14,90,26,'#2f3b35');prop(store,80,40,14,90,26,'#2f3b35');prop(store,130,40,14,90,26,'#2f3b35');prop(store,180,20,50,16,14,'#3a3348');prop(store,0,0,240,8,40,'#2a3a34');
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
for(let i=0;i<6;i++)prop(diner,40+i*52,70,14,14,10,'#ff3ea5',false);
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
for(let i=0;i<5;i++)prop(anchor,50+i*40,88,12,12,10,'#7a4e2a',false);
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
function nearSpot(){if(!me.inside)return null;for(const p of me.inside.spots)if(Math.hypot(p.x-me.x,p.y-me.y)<28)return p;return null}
function interact(){const p=nearSpot();if(!p||state!=='play')return;
  if(p.act==='shop')openShop();
  else if(p.act==='tip'){if(me.cash<10){feed('You need $10 to tip');return}me.cash-=10;clubHype=6;feed('The dancers love it');noise(.2,5000,.15)}
  else if(p.act==='drink'){if(me.cash<15){feed('A drink costs $15');return}me.cash-=15;me.hp=Math.min(BAL.playerHp,me.hp+25);drunk=Math.min(30,drunk+12);feed('Cheers! +25 health')}
  else if(p.act==='snack'){if(me.cash<20){feed('Snacks cost $20');return}me.cash-=20;me.hp=BAL.playerHp;feed('Full health')}
  else if(p.act==='blackjack')openBJ();
  else if(p.act==='liquor'){if(me.cash<25){feed('That costs $25');return}me.cash-=25;drunk=Math.min(60,drunk+20);noise(.15,1200,.15);feed(drunk>35?'You are hammered. Driving will be rough':'Down the hatch')}
  else if(p.act==='vip')startLap();
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
    if(nc>=0&&nc<=N)opts.push(c.d);
    for(const nd of[(c.d+1)%4,(c.d+3)%4]){const nr=c.road+(POS(nd)?1:-1);if(nr>=0&&nr<=N)opts.push(nd)}
    let pick;
    if(greedy){const px=c.d%2===0?c.cross*B+60:c.road*B+60,py=c.d%2===0?c.road*B+60:c.cross*B+60;
      const tx=me.x-px,ty=me.y-py;let best=-9;for(const o of opts){const s=Math.cos(o*Math.PI/2)*tx+Math.sin(o*Math.PI/2)*ty+rand()*30;if(s>best){best=s;pick=o}}}
    else{pick=opts.length>1&&opts[0]===c.d&&rand()<.5?c.d:opts[Math.floor(rand()*opts.length)]}
    if(pick===c.d){c.cross=nc;continue}
    c.nd=pick;c.tgt=c.cross*B+laneOff(pick);return;
  }
  c.nd=(c.d+2)%4;c.tgt=along(c);
}
function laneSpawn(kind,min,max){
  for(let i=0;i<30;i++){
    const d=Math.floor(rand()*4),road=Math.floor(rand()*(N+1)),k=Math.floor(rand()*N),al=k*B+R+rand()*(B-R-20)+10;
    const c=mkCar(0,0,d*Math.PI/2,kind,kind==='police'?'#e9e9f2':CARCOL[Math.floor(rand()*CARCOL.length)]);
    c.d=d;c.road=road;c.cross=POS(d)?k+1:k;setAlong(c,al);
    const dist=Math.hypot(c.x-A.x,c.y-A.y);if(dist<min||dist>max)continue;
    c.cop=kind==='police';decide(c,kind==='police');c.spd=kind==='police'?200:rr(95,140);c.cur=c.spd*.6;cars.push(c);return c;
  }
}
function drive(c,thr,steer,hand,dt){
  const fx=Math.cos(c.a),fy=Math.sin(c.a),P=c===me.car,sh=c.spiked?.55:1,sk=c.spiked?.6:1;
  if(P)modBay(c);
  if(P&&state==='shop'){c.vx=c.vy=0;return} // the shop freezes your car
  let fwd=c.vx*fx+c.vy*fy,lat=-c.vx*fy+c.vy*fx;
  const T=ctOf(c),boost=P&&c.boost,max=(c.kind==='police'?300:T.max*modK(c,'max')*(boost?1.2:1))*sh;
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
  lat-=lat*Math.min(1,lg*dt);
  c.a+=steer*2.7*clamp(fwd/150,-1,1)*dt*(hand?1.35:1)*(P&&Math.abs(fwd)>.75*max?.75:1);
  c.vx=fx*fwd-fy*lat;c.vy=fy*fwd+fx*lat;
  c.x+=c.vx*dt;c.y+=c.vy*dt;
  if(P)driftA=Math.hypot(c.vx,c.vy)>5?Math.abs(wrap(Math.atan2(c.vy,c.vx)-c.a)):0;
}
// Player car height. On the ground z follows groundZ and vz is the ground's rise per second along the motion.
// If the ground falls away faster than the car rises (lip, crest, cliff) the car goes airborne under gravity 650.
function carZ(c,dt){
  const g=groundZ(c.x,c.y);
  if(!c.air&&g<c.z+c.vz*dt-2){c.air=true;c.airT=0}
  if(c.air){
    c.airT+=dt;c.vz-=650*dt;c.z+=c.vz*dt;
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

// ---------- police ----------
let lastSeen=null,unseenT=0,copHeli=null,blockCd=0;
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
  let tx=me.x,ty=me.y;
  if(c.mode==='block'){ // roadblock cruiser: parked until you come within 120, then it joins the chase
    if(heat<=0||!play){c.vx=c.vy=0;return}
    if(!c.chase&&Math.hypot(me.x-c.x,me.y-c.y)>120)return;
    c.chase=true;c.mode='chase';
  }
  const d=Math.hypot(me.x-c.x,me.y-c.y);
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
      if(stn>=2&&c.shootT<=0&&d<300&&!c.burn){c.shootT=rr(1.2,2);const a=Math.atan2(me.y-c.y,me.x-c.x)+rr(-.12,.12);
        if(!blockedLine(c.x,c.y,me.x,me.y))fire(c.x+Math.cos(a)*16,c.y+Math.sin(a)*16,a,'police',BAL.npc.police)}
      if(!c.copped&&stn===1&&d<140&&!me.car&&!me.heli&&!me.jet&&Math.hypot(c.vx,c.vy)<20){c.copped=true;spawnCop(c)}
    }
    if(c.burn)thr=st=0;
    drive(c,thr,st,false,dt);const imp=carWalls(c);if(imp>140)damageCar(c,Math.min(BAL.crashMax,(imp-140)*.05),false);
  }
}
function spawnCop(c){ // a foot cop steps out beside a stopped cruiser
  const a=c.a+1.57;
  peds.push({x:c.x+Math.cos(a)*30,y:c.y+Math.sin(a)*30,vx:0,vy:0,a:a,spd:150,flee:0,fx:0,fy:0,down:0,skin:PEDCOL[Math.floor(rand()*5)],shirt:'#1e2a4d',fem:false,hair:'#1e2a4d',skirt:null,ci:0,dir:1,ph:rand()*TAU,kind:'cop',brave:'coward',cop:true,cd:rr(.8,1.6),armed:0,arT:0});
}
function copPedStep(p,i,dt,stn){
  const d=Math.hypot(me.x-p.x,me.y-p.y);
  if(p.down){p.down-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.02,dt);p.vy*=Math.pow(.02,dt);collide(p,p.x,p.y,6);if(p.down<=0)peds.splice(i,1);return}
  p.armed=stn>=2?9:0;
  let vx=0,vy=0;
  if(heat>0&&state==='play'&&!me.inside){
    if(d>16){vx=(me.x-p.x)/(d||1)*150;vy=(me.y-p.y)/(d||1)*150;p.a=Math.atan2(me.y-p.y,me.x-p.x)}
    p.cd-=dt;
    if(stn>=2&&p.cd<=0&&d<300){p.cd=rr(1.2,2);const a=p.a+rr(-.1,.1);
      if(!blockedLine(p.x,p.y,me.x,me.y))fire(p.x+Math.cos(a)*10,p.y+Math.sin(a)*10,a,'police',BAL.npc.police)}
    if(stn===1&&!me.car&&!me.heli&&!me.jet&&d<26&&!me.inside){ // arrest: box you in for 1.2 s
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
  for(const c of cars){
    if(c.kind==='dead'||c.spiked)continue;
    const px=c.x-c.vx*dt,py=c.y-c.vy*dt;if(px===c.x&&py===c.y)continue;
    for(const s of spikes){const hx=Math.cos(s.a)*s.l/2,hy=Math.sin(s.a)*s.l/2;
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
  const pa=me.car?me.car.a:me.a,tx=me.x-Math.cos(pa)*80,ty=me.y-Math.sin(pa)*80,dx=tx-h.x,dy=ty-h.y,d=Math.hypot(dx,dy)||1,sp=Math.min(260,d*2);
  h.vx+=(dx/d*sp-h.vx)*Math.min(1,dt*1.5);h.vy+=(dy/d*sp-h.vy)*Math.min(1,dt*1.5);
  h.x+=h.vx*dt;h.y+=h.vy*dt;h.a+=wrap(Math.atan2(dy,dx)-h.a)*Math.min(1,dt*3);h.z=150;
  if(h.hp<=0){h.falling=true;h.vz=0;return}
  h.shootT-=dt;
  if(st>=5&&h.shootT<=0){h.shootT=2.5;fireZ=h.z-groundZ(h.x,h.y);fireSlope=clamp((groundZ(me.x,me.y)+2-h.z)/(Math.hypot(me.x-h.x,me.y-h.y)||1),-3,2);
    for(let i=0;i<3;i++){const a=Math.atan2(me.y-h.y,me.x-h.x)+rr(-.42,.42);fire(h.x,h.y,a,'police',8)} // sprayed from a hovering platform
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
  if(seen){lastSeen={x:me.x,y:me.y};unseenT=0}else if(heat>0)unseenT+=dt; // no heat, no one is watching
  coolT=seen?0:coolT+dt; // pdPay reads coolT as the time since the cops last saw you
  const pv=heat;
  if(heat>0){ // hide: waited out the search, or sat outside the search circle
    const st0=Math.ceil(heat-.001),r=220+140*st0;
    if(unseenT>5+3*st0||(unseenT>=3&&lastSeen&&Math.hypot(me.x-lastSeen.x,me.y-lastSeen.y)>r))heat=0;
  }
  if(heat===0&&pv>0){
    if(maxHeatThisChase>=2)gainXP(40*maxHeatThisChase,'Lost the cops');
    feed('You lost the cops');
    for(let i=cars.length-1;i>=0;i--)if(cars[i].mode==='block')cars.splice(i,1);
    spikes.length=0;copHeli=null;lastSeen=null;unseenT=0;blockCd=0;
  }
  if(heat>maxHeatThisChase)maxHeatThisChase=heat;
  if(heat===0){maxHeatThisChase=0;unseenT=0;lastSeen=null}
  // population: one cruiser per star, SWAT vans at 5, roadblocks at 3, the helicopter at 4
  const st=heat>0?Math.ceil(heat-.001):0,want=[0,1,2,3,4,5][st];
  let pol=0;for(let i=cars.length-1;i>=0;i--){const c=cars[i],d=Math.hypot(c.x-A.x,c.y-A.y);
    if(c.kind==='police'){const on=c.mode!=='block';if(on)pol++;if((heat===0&&(d>650||c.mode==='block'))||d>1500){cars.splice(i,1);if(on)pol--}}
    else if((c.kind==='parked'||c.kind==='dead'||c.kind==='traffic')&&d>1700&&!(c.type==='armored'&&c.kind!=='dead')&&!c.mark){cars.splice(i,1)}}
  if(pol<want&&state==='play'&&rand()<dt*.3){const c=laneSpawn('police',650,1000);
    if(c&&st>=5&&rand()<.5){c.type='armored';c.color='#1d2433';c.hp=400}} // half the new 5 star cruisers are SWAT vans
  if(!copHeli&&st>=4&&state==='play')copHeli=spawnCopHeli();
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
      spikes.push({x:bx,y:by,a:vert?0:Math.PI/2,l:70});
      blockCd=25;break;
    }
  }
  spikeStep(dt);
  for(let i=peds.length-1;i>=0;i--){const p=peds[i];if(p&&p.cop)copPedStep(p,i,dt,st)}
}
function policeClear(){ // respawn and die('BUSTED') drop everything the police own
  for(let i=peds.length-1;i>=0;i--)if(peds[i].cop)peds.splice(i,1);
  for(let i=cars.length-1;i>=0;i--)if(cars[i].mode==='block')cars.splice(i,1);
  spikes.length=0;copHeli=null;lastSeen=null;unseenT=0;blockCd=0;
}
if(DBG)Object.defineProperties(DBG,{unseenT:{get:()=>unseenT},lastSeen:{get:()=>lastSeen},copHeli:{get:()=>copHeli},spikes:{get:()=>spikes},addHeat:{get:()=>addHeat}});

// ---------- peds ----------
const SPORTS=['#ff3ea5','#29e6d6','#ffc94a','#7b6bff'];
const BARKS={bump:['Watch it!','Hey!','Excuse you.'],near:['Are you crazy?!','Slow down!'],gun:["He's got a gun!",'Run!'],call:['Police? Yes, hi...'],nice:['Nice ride.'],greet:['Hi.','Do I know you?','Lovely night.','Leave me alone.']};
const VENDORS=[[1007,1160],[1447,1600],[1887,2480],[1447,4240],[3207,4240]]; // left sidewalk edge, beside a hot dog cart
function spawnPed(x,y){
  let px=x,py=y;const rnd=x===undefined;if(rnd){[px,py]=pointAway(450,1400)}
  const bi=clamp(Math.floor((px-R/2)/B),0,N-1),bj=clamp(Math.floor((py-R/2)/B),0,N-1),d=district(bi,bj);
  const venue=DOORS.some(v=>/Velvet|Snack|Casino/.test(v.label)&&Math.hypot(v.x-px,v.y-py)<500);
  const p={x:px,y:py,vx:0,vy:0,a:0,spd:rr(28,44),flee:0,fx:0,fy:0,down:0,skin:PEDCOL[Math.floor(rand()*5)],shirt:SHIRT[Math.floor(rand()*7)],fem:rand()<.5,hair:HAIRC[Math.floor(rand()*6)],skirt:rand()<.5?['#2a2d3a','#7a2f3a','#3a3f5a','#c9c3d6'][Math.floor(rand()*4)]:null,ci:0,dir:rand()<.5?1:-1,ph:rand()*TAU,kind:'walk',brave:'coward'};
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
  if(!p.cop){pickups.push({x:p.x,y:p.y,amt:Math.floor(p.gang?rr(40,150):rr(5,40)),t:25});if(p.gang&&rand()<.3)pickups.push({x:p.x-6,y:p.y+4,powder:1,amt:0,t:25})}
  burst(p.x,p.y,8,'#ffd27a',140,.35);
  if(byMe){if(p.cop)addHeat(.6);else if(p.gang)addHeat(.1);else crime(p.x,p.y,.4)}if(p.gang&&byMe)gainXP(6,'Gang member');
  if(p.gang){for(const q of peds)if(q.gang&&!q.down&&Math.hypot(q.x-p.x,q.y-p.y)<420)q.aggro=true;if(byMe&&job&&job.type==='turf'&&(p.gname||'Vipers')===(job.gname||'Vipers'))job.n++}
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
    if(p.gang){if(p.down){p.down-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.02,dt);p.vy*=Math.pow(.02,dt);if(p.down<=0)peds.splice(i,1)}else if(Math.hypot(p.x-A.x,p.y-A.y)>1800)peds.splice(i,1);else gangStep(p,dt);continue}
    if(pedStep(p,dt))peds.splice(i,1);
  }
}
// Civilians. Returns true when the ped should be removed.
function pedStep(p,dt){
  if(p.cop)return false;
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
function burst(x,y,n,col,spd,life,kind){for(let i=0;i<n;i++){const a=rand()*TAU,s=rand()*spd;parts.push({x,y,z0:burstZ,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:life*(.5+rand()*.5),max:life,col,k:kind||'spark',sz:kind==='smoke'?rr(6,12):2})}}
const glowCache={};
function glow(col){if(glowCache[col])return glowCache[col];const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);return glowCache[col]=c}
const cone=(()=>{const c=document.createElement('canvas');c.width=180;c.height=110;const g=c.getContext('2d'),gr=g.createRadialGradient(0,55,0,0,55,180);gr.addColorStop(0,'rgba(255,240,200,.55)');gr.addColorStop(1,'rgba(255,240,200,0)');g.fillStyle=gr;g.beginPath();g.moveTo(0,48);g.lineTo(180,0);g.lineTo(180,110);g.lineTo(0,62);g.closePath();g.fill();return c})();

// ---------- audio ----------
let AC=null;
function audioInit(){try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume()}catch(e){AC=null}}
function noise(dur,freq,vol){if(!AC||muted||vol<.01)return;try{const n=Math.floor(AC.sampleRate*dur),buf=AC.createBuffer(1,n,AC.sampleRate),d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(rand()*2-1)*Math.pow(1-i/n,3);
  const s=AC.createBufferSource();s.buffer=buf;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=freq;const g=AC.createGain();g.gain.value=vol;s.connect(f);f.connect(g);g.connect(AC.destination);s.start()}catch(e){}}
const vol=(x,y)=>clamp(1-Math.hypot(x-me.x,y-me.y)/900,0,1);
// [pitch factor, cylinders, redline rpm, gear top speeds]
const ENG={sedan:[1,4,6500,[0,50,100,160,225,300,360]],taxi:[1,4,6200,[0,50,100,160,225,300,360]],sports:[1.25,6,8400,[0,62,125,190,262,340,460]],muscle:[.7,8,6200,[0,58,120,185,260,340,420]],
  suv:[.85,6,5800,[0,42,88,145,205,280,320]],van:[.8,4,5200,[0,36,78,128,185,250,280]],pickup:[.78,8,5600,[0,42,88,145,205,280,330]],police:[.9,8,6800,[0,52,108,170,235,310,360]],armored:[.6,8,4800,[0,32,72,122,180,240,300]]};
const SND={ready:false};
function sndInit(){if(SND.ready||!AC)return;try{
  const m=AC.createGain();m.connect(AC.destination);SND.master=m;
  const nb=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const nsrc=()=>{const s=AC.createBufferSource();s.buffer=nb;s.loop=true;s.start();return s};
  const gain=(v,to)=>{const g=AC.createGain();g.gain.value=v;if(to)g.connect(to);return g};
  const filt=(type,f,q,to)=>{const b=AC.createBiquadFilter();b.type=type;b.frequency.value=f;if(q)b.Q.value=q;if(to)b.connect(to);return b};
  const osc=(type,f,to)=>{const o=AC.createOscillator();o.type=type;o.frequency.value=f;if(to)o.connect(to);o.start();return o};
  const hg=gain(0,m),hm=gain(.5,hg),lfo=osc('sine',12),lg=gain(.5);lfo.connect(lg);lg.connect(hm.gain);nsrc().connect(filt('lowpass',320,0,hm));
  const wg=gain(0,m);osc('sine',1150,wg);SND.heli={hg,lfo,wg};
  const sg=gain(0,m),so=osc('sawtooth',700,filt('lowpass',2200,0,sg));SND.siren={so,sg};
  const tgg=gain(0,m),to=osc('sawtooth',40,filt('lowpass',240,0,tgg));SND.traffic={to,tgg};
  nsrc().connect(filt('lowpass',180,0,gain(.015,m)));
  const be=gain(0,m),bw=gain(.025,be);nsrc().connect(filt('lowpass',500,0,bw));osc('sine',.12,gain(.025,bw.gain));SND.beach=be;
  const wn=gain(0,m);nsrc().connect(filt('bandpass',600,1,wn));SND.wind=wn;
  const sc=gain(0,m);osc('sawtooth',900,filt('bandpass',900,2,sc));SND.screech=sc;
  SND.rg=gain(.05,m);
  SND.ready=true}catch(e){SND.ready=false}}
function soundStep(dt){if(!AC)return;sndInit();if(!SND.ready)return;const t=AC.currentTime,S=(p,v,k)=>p.setTargetAtTime(v,t,k||.05);
  S(SND.master.gain,muted||state==='menu'?0:1,.1);
  // helicopter rotor
  {let hv=0,rate=12;if(heli&&!heli.dead){const d=me.heli===heli?0:Math.hypot(heli.x-A.x,heli.y-A.y);hv=heli.spin/28*clamp(1-d/1100,0,1);rate=8+heli.spin/28*6}
   S(SND.heli.hg.gain,hv*.32,.15);S(SND.heli.lfo.frequency,rate,.2);S(SND.heli.wg.gain,hv*.012,.2)}
  // sirens
  {let best=1e9;if(!me.inside)for(const v of cars)if(v.kind==='police'&&heat>0){const d=Math.hypot(v.x-me.x,v.y-me.y);if(d<best)best=d}
   S(SND.siren.sg.gain,best<900?.05*(1-best/900):0,.1);S(SND.siren.so.frequency,Math.floor(time*1.6)%2?980:720,.03);S(SND.rg.gain,best<900?.02:.05,.2)}
  const shift=keys.ShiftLeft||keys.ShiftRight,onFoot=state==='play'&&!me.car&&!me.heli&&!me.jet;
  // tyres: sliding sideways, or handbrake at speed
  {const c=me.car,lat=c?Math.abs(-Math.sin(c.a)*c.vx+Math.cos(c.a)*c.vy):0;
   S(SND.screech.gain,c&&state==='play'&&(lat>120||shift&&Math.hypot(c.vx,c.vy)>150)?.05:0,.05)}
  // footsteps
  if(onFoot&&Math.hypot(me.vx,me.vy)>40){stepT-=dt;if(stepT<=0){stepT=shift?.25:.34;const dn=district(clamp(Math.floor(me.x/B),0,N-1),clamp(Math.floor(me.y/B),0,N-1));sfx(.04,'lowpass',dn==='beach'||dn==='park'?400:700,.06)}}else stepT=0;
  // ambience: beach waves, wind, club bass
  const bd=Math.max(0,(N-1)*B-me.y),dr=doorAt(3,3),kd=Math.hypot(dr.x-me.x,dr.y-me.y);
  S(SND.beach.gain,clamp(1-bd/600,0,1),.3);
  S(SND.wind.gain,state==='play'&&(me.roof||me.heli||me.jet||(me.z||0)>8)?.03:0,.3);
  clubT-=dt;if(clubT<=0){clubT+=60/118;const kv=me.inside===club?.12:kd<450?.06*(1-kd/450):0;if(kv)tone('sine',55,.15,kv)}
  // car radio: look ahead 0.2 s and schedule notes
  if(!me.car){if(radOsc.size)radStop()}
  else if(radio&&state==='play'){if(radNext<t)radNext=t+.05;while(radNext<t+.2){radSched(radN++,radNext);radNext+=60/RBPM[radio]/4}}
}

// one oscillator note, held then faded out over dur
function tone(type,f,dur,v,at,to,f2){if(!AC||muted)return;try{const t=at||AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.setValueAtTime(v,t);g.gain.linearRampToValueAtTime(0,t+dur);o.connect(g);g.connect(to||SND.master);o.start(t);o.stop(t+dur);return o}catch(e){}}
// noise burst through one filter; f2 sweeps the filter to that frequency over dur
function sfx(dur,type,f,v,at,f2,to){if(!AC||muted||v<.01)return;try{const t=at||AC.currentTime,n=Math.floor(AC.sampleRate*dur),buf=AC.createBuffer(1,n,AC.sampleRate),d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(rand()*2-1)*Math.pow(1-i/n,3);
  const s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();s.buffer=buf;fl.type=type;fl.frequency.setValueAtTime(f,t);if(f2)fl.frequency.linearRampToValueAtTime(f2,t+dur);g.gain.value=v;s.connect(fl);fl.connect(g);g.connect(to||SND.master);s.start(t);return s}catch(e){}}
let stepT=0,clubT=0,thudT=0;
// shot sound for a WEAPONS id. fire() calls it for the player and remote players, throwSticky() for bombs
function gunSnd(id,x,y){if(!AC||muted)return;const v=vol(x,y);
  switch(id){
    case'pistol':case'smg':{const k=id==='smg'?.7:1;sfx(id==='smg'?.06:.12,'bandpass',2500,.22*k*v);tone('square',180,.05,.08*k*v);break}
    case'shotgun':sfx(.35,'lowpass',900,.5*v);break;
    case'mg':sfx(.07,'bandpass',1600,.22*v);break;
    case'sniper':sfx(.5,'lowpass',3000,.4*v);sfx(.5,'lowpass',800,.2*v,AC.currentTime+.18);break;
    case'rpg':case'homing':sfx(.6,'lowpass',400,.4*v,0,2000);break;
    case'sticky':sfx(.08,'lowpass',3000,.12*v);break;
  }}
// car impact; at most one per 0.15 s
function thud(s){if(time<thudT)return;thudT=time+.15;sfx(.18,'lowpass',300,clamp(s/400,0,.4))}
function hornSnd(){const h=MODS_HORN.find(h=>h[0]===(me.car&&me.car.mods&&me.car.mods.horn))||MODS_HORN[0];tone('square',h[0],.4,.08);tone('square',h[1],.4,.08)}
const mf=m=>440*Math.pow(2,(m-69)/12);
const JINGLE={pass:[[60,.08],[64,.08],[67,.08],[72,.08]],fail:[[64,.15],[60,.2]],buy:[[84,.05],[88,.05]],level:[[60,.15],[64,.15],[67,.15],[72,.15],[76,.15],[79,.3]]};
function jingle(k){if(!AC||muted)return;let t=AC.currentTime;for(const[m,d]of JINGLE[k]){tone('triangle',mf(m),d,.2,t);t+=d}}
// car radio. Station 0 is off. Chords are Am F C G as MIDI notes.
const RADIO=['Off','Neon FM','Palm Wave','Low Palms Radio'],RBPM=[0,100,70,90],CHORDS=[[57,60,64],[53,57,60],[60,64,67],[55,59,62]];
let radio=0,radN=0,radNext=0;const radOsc=new Set();
function rtrack(o){if(o){radOsc.add(o);o.onended=()=>radOsc.delete(o)}}
function radNote(type,m,at,dur,v){rtrack(tone(type,mf(m),dur,v,at,SND.rg))}
function radSched(n,t){const c=CHORDS[(n>>4)&3];
  if(radio===1){if(n%2===0)radNote('sawtooth',c[0]-12,t,.12,.5);if(n%8===0)for(const m of c)radNote('square',m,t,.1,.12)}
  else if(radio===2){if(n%16===0)for(const m of c)radNote('triangle',m,t,1.5,.25)}
  else{if(n%8===0)rtrack(tone('sine',120,.2,.9,t,SND.rg,50));if(n%8===4)rtrack(sfx(.15,'bandpass',1800,.6,t,0,SND.rg));if(n%4===2)radNote('sawtooth',c[0]-24,t,.1,.4)}}
function radStop(){for(const o of radOsc)try{o.stop()}catch(e){}radOsc.clear();radNext=0}
function cycleRadio(){radio=(radio+1)%RADIO.length;radStop();feed('Radio: '+RADIO[radio])}
if(DBG)Object.defineProperties(DBG,{audio:{get:()=>AC&&AC.state},radio:{get:()=>radio}});

// ---------- combat ----------
function fire(x,y,a,owner,dmg,rocket,quiet,home,snd){const sp=home?470:rocket?(fireSpd||560):(fireSpd||950);bullets.push({x,y,px:x,py:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:home?4.5:rocket?(fireLife||1.6):(fireLife||.7),z:fireZ+(owner==='me'||owner==='remote'?0:groundZ(x,y)),vz:fireSlope*sp,owner,dmg,rocket:!!rocket,home:home||null});
  if(quiet)return;
  parts.push({x:x+Math.cos(a)*6,y:y+Math.sin(a)*6,vx:0,vy:0,life:.06,max:.06,col:'#ffe9a8',k:'flash',sz:rocket?30:16});if(snd)gunSnd(snd,x,y);else noise(rocket?.45:.12,rocket?900:2600,(rocket?.4:.22)*vol(x,y));scare(x,y,320);}
function segDist(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;let t=l?((px-ax)*dx+(py-ay)*dy)/l:0;t=clamp(t,0,1);return Math.hypot(px-ax-dx*t,py-ay-dy*t)}
function myShoot(){
  if(me.fireCd>0||state!=='play'||wheelOpen||phoneOpen)return;
  if(me.heli){heliFire();return}
  if(me.jet){jetFire();return}
  let w=WEAPONS[WI[weap]];
  if(w.id!=='pistol'&&!(ammo[w.id]>0)){weap='pistol';w=WEAPONS[0];feed('Out of ammo. Back to the pistol')}
  me.fireCd=w.cd*(me.car?1.15:1);
  if(w.id!=='pistol')ammo[w.id]--;lastFireT=time;if(me.inside&&me.inside.bank)triggerAlarm('Shots fired!');
  if(w.throw){if(!throwSticky())ammo[w.id]++;return}
  fireZ=(me.car?me.car.z||0:me.z||0)+12;fireSpd=w.speed||0;fireLife=w.life||0;fireSlope=0;
  if(!me.car&&aimPt){const dx=aimPt[0]-me.x,dy=aimPt[1]-me.y,dh=Math.hypot(dx,dy);if(dh>4){me.a=Math.atan2(dy,dx);fireSlope=clamp((aimPt[2]-fireZ)/dh,-3,3)}}
  const c=me.car,a=c?c.a:(aimPt?me.a:(me.a=look.yaw)),x=c?c.x+Math.cos(a)*26:me.x+Math.cos(a)*12,y=c?c.y+Math.sin(a)*26:me.y+Math.sin(a)*12;
  for(let i=0;i<w.pellets;i++)fire(x,y,a+rr(-w.spread,w.spread),'me',w.dmg*(power>0?2:1),w.rocket,i>0,w.homing&&lockTarget?lockTarget:null,w.id);
  shotSeq=(shotSeq+1)%1e6;lastShot=[shotSeq,Math.round(x),Math.round(y),Math.round(a*100)/100,WI[w.id],w.homing&&lockTarget&&lockTarget.peer?lockTarget.peer:null,Math.round(fireZ),Math.round(fireSlope*100)/100];
  fireZ=12;fireSpd=0;fireLife=0;fireSlope=0;
  if(w.rocket)shake=Math.max(shake,5);
  if(time>heatShotT)for(const p of cars)if(p.kind==='police'&&Math.hypot(p.x-me.x,p.y-me.y)<450){addHeat(.08);heatShotT=time+2;break}
}
function addHeat(v){heat=clamp(heat+v,0,5);coolT=0}
function explode(x,y,byMe,cosmetic,ez,k=1,sk){const gz=groundZ(x,y);ez=ez===undefined?gz:Math.max(0,ez);burstZ=ez;
  burst(x,y,40,'#ffb347',320,.7);burst(x,y,26,'#ff3ea5',220,.5);burst(x,y,18,'rgba(60,50,70,1)',90,2.2,'smoke');
  parts.push({x,y,z0:ez,vx:0,vy:0,life:.25,max:.25,col:'#fff1c2',k:'flash',sz:180});
  noise(1.1,380,.7*vol(x,y));shake=Math.max(shake,14*vol(x,y));
  for(const c of cars){const d=Math.hypot(c.x-x,c.y-y);if(d<BAL.exp.veh[1]&&ez-gz<50){damageCar(c,fall(d,BAL.exp.veh)*k*(sk&&c===sk.car?BAL.exp.sticky:1),byMe);if(d>1&&dynamic(c)){c.vx+=(c.x-x)/d*260;c.vy+=(c.y-y)/d*260}}}
  for(const p of peds){const d=Math.hypot(p.x-x,p.y-y);if(d<BAL.exp.ped&&ez-gz<50)knockPed(p,(p.x-x)*4,(p.y-y)*4,byMe)}
  for(const v of[heli,...jets]){if(!v||v.dead||cosmetic)continue;v.hp-=fall(Math.hypot(v.x-x,v.y-y,(v.z||0)-ez),BAL.exp.air)*k}
  const dm=Math.hypot(me.x-x,me.y-y);
  if(dm<BAL.exp.player[1]&&Math.abs((me.z||0)-ez)<45&&!me.heli&&!me.jet&&!cosmetic&&!(me.car&&me.car.type==='armored'))hurtMe(fall(dm,BAL.exp.player)*k*(byMe?BAL.exp.self:1)*(me.car?BAL.exp.occupant:1),null);
  if(byMe)for(const[peer,r]of remotes){const d=Math.hypot(r.x-x,r.y-y);if(d<BAL.exp.player[1]&&!r.dead&&Math.abs((r.inCar?(r.cz||0):(r.z||0))-ez)<50)dmgOut[peer]=(dmgOut[peer]||0)+Math.round(fall(d,BAL.exp.player)*k*(sk&&peer===sk.peer?BAL.exp.sticky:1))}
  scare(x,y,400);burstZ=0;
}
function hurtMe(amt,from){
  if(state!=='play'||me.inv>0||amt<=0)return;
  me.hp-=amt*(power>0?.35:1)*palmMul();me.lastHurt=time;if(from){me.lastHitBy=from;me.lastHitT=time}
  $('vig').style.boxShadow='inset 0 0 140px rgba(255,40,60,.55)';setTimeout(()=>$('vig').style.boxShadow='',180);
  if(me.hp<=0)die('WASTED');
}
function die(word,fine){
  if(state!=='play')return;if(word==='WASTED'&&placesRevive())return;if(heist.carry){feed('You dropped the gold');heist.carry=0}
  state='dead';deadT=3.2;me.hp=0;if(word==='BUSTED')policeClear();
  if(me.lastHitBy&&time-me.lastHitT<5&&remotes.has(me.lastHitBy)){killedBy[me.lastHitBy]=(killedBy[me.lastHitBy]||0)+1;feed(`${remotes.get(me.lastHitBy).name} wasted you`)}
  if(me.car){leaveCar(true)}if(me.jet)me.jet=null;
  const loss=Math.floor(me.cash*(fine||(word==='BUSTED'?.15:.1)));me.cash-=loss;
  showBig(word,word==='BUSTED'?'#4aa3ff':'#ff4b4b',loss?`-$${loss}`:'');
}
function respawn(){for(const q of peds){q.calling=0;q.fight=0;q.armed=0}handsUp=false;me.inside=null;me.heli=null;me.jet=null;me.z=0;jvz=0;stam=1;stamOut=false;me.roof=null;me.climb=null;drunk=0;
  const[x,y]=job&&job.respawn||hospitalSpot();me.x=x;me.y=y;me.z=groundZ(x,y);me.vx=me.vy=0;me.hp=BAL.playerHp;me.inv=2.5;me.bustT=0;heat=0;state='play';hideBig();
  for(let i=cars.length-1;i>=0;i--)if(cars[i].kind==='police')cars.splice(i,1);
  policeClear();
}

// ---------- enter / exit ----------
function nearestCar(){let best=null,bd=48;for(const c of cars){if(c.kind==='dead'||c.burn)continue;const d=Math.hypot(c.x-me.x,c.y-me.y);if(d<bd){bd=d;best=c}}return best}
function nearLadder(){if(me.car||me.inside||me.climb)return null;for(const b of ladders){const L=b.ladder;if(me.roof===b){if(Math.hypot(L.x-me.x,L.top-me.y)<20)return{b,up:false}}else if(!me.roof&&Math.hypot(L.x-me.x,L.base-me.y)<18)return{b,up:true}}return null}
function tryLadder(){const n=nearLadder();if(!n)return false;me.climb={b:n.b,up:n.up,t:0,dur:Math.max(.9,n.b.H/150)};me.vx=me.vy=0;return true}
function toggleCar(){
  if(lap){endLap();return}
  if(state!=='play')return;
  if(me.inside){interact();return}
  if(me.heli){const h=me.heli,g=heliGround(h.x,h.y);if(h.z-g>14){feed('Land first. Hold Shift to descend');return}
    me.heli=null;const rb=g>2?roofAt(h.x,h.y):null;
    if(rb){me.roof=rb;me.x=clamp(h.x+30,rb.x+5,rb.x+rb.w-5);me.y=clamp(h.y,rb.y+5,rb.y+rb.h-5);me.z=rb.H+1.6}
    else{me.roof=null;me.x=h.x+Math.cos(h.a+1.57)*34;me.y=h.y+Math.sin(h.a+1.57)*34;me.z=groundZ(me.x,me.y);collide(me,me.x,me.y,8)}return}
  if(me.jet){const j=me.jet,g=heliGround(j.x,j.y);if(j.z-g>5||j.speed>40){feed('Land and come to a stop first');return}
    me.jet=null;me.x=j.x+Math.cos(j.a+1.57)*36;me.y=j.y+Math.sin(j.a+1.57)*36;me.z=groundZ(me.x,me.y);collide(me,me.x,me.y,8);return}
  {const j=me.car?null:nearJet();if(j&&!unlocked('jet'))feed(`You need level ${UNLOCK.jet} to fly the fighter jet`);else if(j){me.jet=j;me.roof=null;me.climb=null;look.yaw=j.a;feed('Fighter jet: W throttle, mouse steers, Space climbs, Shift dives, click fires');return}}
  if(!me.car&&heli&&!heli.dead&&!heli.falling&&Math.hypot(heli.x-me.x,heli.y-me.y)<50&&Math.abs(heli.z-(me.z||0))<24){if(!unlocked('heli'))feed(`You need level ${UNLOCK.heli} to fly the attack helicopter`);else{me.heli=heli;me.roof=null;me.climb=null;return}}
  if(!me.car&&tryLadder())return;
  if(me.roof)return;
  if(!me.car&&nearDealer()){buyPowder();return}
  if(me.car){leaveCar(false);return}
  const c=nearestCar();if(!c){talkPed();return}
  if(c.kind==='traffic')crime(c.x,c.y,.3);
  if(c.kind==='traffic'){const p=spawnPed(c.x+Math.cos(c.a-1.57)*20,c.y+Math.sin(c.a-1.57)*20);p.flee=4;p.fx=c.x;p.fy=c.y;c.vx=Math.cos(c.a)*c.cur*.3;c.vy=Math.sin(c.a)*c.cur*.3;
    for(const q of cars)if(q.kind==='police'&&Math.hypot(q.x-me.x,q.y-me.y)<400){addHeat(.5);break}}
  if(c.kind==='police')addHeat(1);
  c.kind='mine';me.car=c;handsUp=false;
}
function leaveCar(force){
  const c=me.car;if(!c)return;
  const sp=Math.hypot(c.vx,c.vy);if(!force&&sp>120)return;
  c.kind='parked';c.air=false;me.car=null;
  for(const s of[-1,1]){const x=c.x+Math.cos(c.a+s*1.57)*24,y=c.y+Math.sin(c.a+s*1.57)*24;if(!inBuilding(x,y)){me.x=x;me.y=y;break}}me.z=groundZ(me.x,me.y);
  me.vx=me.vy=0;
}

// ---------- gun shop ----------
function openShop(){try{document.exitPointerLock&&document.exitPointerLock()}catch(_){}mouse.down=false;state='shop';$('shop').hidden=false;renderShop();setTimeout(()=>$('shopClose').focus(),0)}
function closeShop(){if(state!=='shop')return;bjLeave();tableK=1;state='play';$('shop').hidden=true;$('bj').hidden=true;document.querySelectorAll('.gm').forEach(e=>e.hidden=true);cv.focus&&cv.focus()}
function equip(id){if(owned[id]){weap=id;if(state==='shop')renderShop()}}
function cycleWeapon(){const list=WEAPONS.filter(w=>owned[w.id]);const i=list.findIndex(w=>w.id===weap);equip(list[(i+1)%list.length].id)}
function prevWeapon(){const list=WEAPONS.filter(w=>owned[w.id]);const i=list.findIndex(w=>w.id===weap);equip(list[(i-1+list.length)%list.length].id)}
function renderShop(){
  $('shopCash').textContent='$'+me.cash.toLocaleString('en-US');
  const L=$('shopList');L.replaceChildren();
  WEAPONS.forEach((w,i)=>{
    const row=document.createElement('div');row.className='gun'+(weap===w.id?' eq':'');
    const nm=document.createElement('div');nm.className='nm';nm.textContent=`${i+1} · ${w.name}`;
    const ds=document.createElement('div');ds.className='ds';
    ds.textContent=w.desc+(owned[w.id]&&w.id!=='pistol'?` Ammo: ${ammo[w.id]||0}.`:'');
    const acts=document.createElement('div');acts.className='acts';
    const btn=(label,cls,dis,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(cls)b.className=cls;b.disabled=dis;b.onclick=fn;acts.appendChild(b)};
    if(!owned[w.id]&&!unlocked(w.id))btn(`Unlocks at level ${UNLOCK[w.id]}`,'buy',true,null);
    else if(!owned[w.id])btn(`Buy $${w.price}`,'buy',me.cash<w.price,()=>{if(me.cash<w.price)return;me.cash-=w.price;owned[w.id]=true;ammo[w.id]=(ammo[w.id]||0)+w.ammoAmt;weap=w.id;jingle('buy');saveArsenal();renderShop()});
    else{
      btn(weap===w.id?'Equipped':'Equip','',weap===w.id,()=>equip(w.id));
      if(w.id!=='pistol')btn(`+${w.ammoAmt} ammo $${w.ammoPrice}`,'buy',me.cash<w.ammoPrice,()=>{if(me.cash<w.ammoPrice)return;me.cash-=w.ammoPrice;ammo[w.id]=(ammo[w.id]||0)+w.ammoAmt;jingle('buy');saveArsenal();renderShop()});
    }
    row.append(nm,acts,ds);L.appendChild(row);
  });
}
function saveArsenal(){try{localStorage.setItem('pr3d-arsenal',JSON.stringify({owned,ammo,cash:me.cash,bonus10k:true,powder,xp}))}catch(e){}}
function loadArsenal(d){
  if(!d||typeof d!=='object')return;
  if(d.owned&&typeof d.owned==='object')for(const w of WEAPONS)if(d.owned[w.id]===true)owned[w.id]=true;
  if(d.ammo&&typeof d.ammo==='object')for(const w of WEAPONS)if(Number.isFinite(d.ammo[w.id]))ammo[w.id]=Math.max(0,Math.floor(d.ammo[w.id]));
  if(Number.isFinite(d.cash))me.cash=Math.max(0,Math.floor(d.cash));if(!d.bonus10k)me.cash=Math.max(me.cash,10000);
  if(Number.isFinite(d.powder))powder=clamp(Math.floor(d.powder),0,99);
  if(Number.isFinite(d.xp))xp=clamp(Math.floor(d.xp),0,1e7);lv=lvOf(xp);
  if(typeof d.weap==='string'&&owned[d.weap])weap=d.weap;
}
$('shopClose').addEventListener('click',closeShop);

// ---------- attack helicopter ----------
const PAD={x:3*B+R+160,y:1*B+R+160};
let heliRocketCd=0;
if(DBG)Object.defineProperties(DBG,{heli:{get:()=>heli},PAD:{get:()=>PAD}});
function spawnHeli(){heli={x:PAD.x,y:PAD.y,z:0,a:-Math.PI/2,vx:0,vy:0,vz:0,hp:BAL.heliHp,falling:false,dead:false,tilt:0,roll:0,spin:0}}
function heliGround(x,y){let g=groundZ(x,y);nearB(x,y,b=>{if(b.kind!=='water'&&x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h)g=Math.max(g,(b.H||0)+(b.kind==='house'?16:1.6))});return g}
function roofAt(x,y){let r=null;nearB(x,y,b=>{if(b.kind!=='water'&&b.kind!=='house'&&x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h)r=b});return r}
function heliStep(dt){
  flareCd=Math.max(0,flareCd-dt);heliRocketCd=Math.max(0,heliRocketCd-dt);
  if(!heli){spawnHeli();return}
  const h=heli,mine=me.heli===h;
  if(h.dead){heliWait+=dt;if(heliWait>30){heliWait=0;spawnHeli();feed('A new attack helicopter landed at the Lagoon Park helipad')}return}
  const g0=heliGround(h.x,h.y);
  if(h.falling){h.vz-=320*dt;h.a+=dt*5;h.x+=h.vx*dt;h.y+=h.vy*dt;h.z+=h.vz*dt;h.spin=20;if(h.z<=g0){h.z=g0;h.dead=true;explode(h.x,h.y,mine,false,g0);explode(h.x+20,h.y,mine,false,g0);if(mine){me.heli=null;me.z=0;me.roof=null;die('WASTED')}}return}
  if(h.hp<=0){h.falling=true;if(mine)feed('Mayday! The helicopter is going down');return}
  let f=0,rt=0,up=0;
  if(mine&&state==='play'){f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);rt=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
    if(stick.id!==null){f=-stick.y;rt=stick.x}up=(keys.Space||heliUpT?1:0)-(keys.ShiftLeft||keys.ShiftRight||heliDnT?1:0);
    h.a+=wrap(look.yaw-h.a)*Math.min(1,dt*3)}
  const fx=Math.cos(h.a),fy=Math.sin(h.a),airborne=h.z>g0+1;
  if(airborne||up>0){h.vx+=(fx*f-fy*rt)*540*dt;h.vy+=(fy*f+fx*rt)*540*dt}
  const damp=Math.exp(-(airborne?1.1:6)*dt);h.vx*=damp;h.vy*=damp;const hs=Math.hypot(h.vx,h.vy);if(hs>420){h.vx*=420/hs;h.vy*=420/hs}
  const tvz=mine?up*230:-80;h.vz+=(tvz-h.vz)*Math.min(1,dt*3);
  const nx=clamp(h.x+h.vx*dt,-400,W+400),ny=clamp(h.y+h.vy*dt,HILL.edge,W+700),ng=heliGround(nx,ny);
  if(ng>h.z+3){if(hs>160)h.hp-=hs*BAL.heliWallK;h.vx*=-.35;h.vy*=-.35;shake=Math.max(shake,mine?6:0)}else{h.x=nx;h.y=ny}
  h.z=Math.min(820,h.z+h.vz*dt);const gg=heliGround(h.x,h.y);if(h.z<gg){h.z=gg;h.vz=Math.max(0,h.vz)}
  h.tilt+=(clamp(-(h.vx*fx+h.vy*fy)/1400,-.3,.3)-h.tilt)*Math.min(1,dt*4);h.roll+=(clamp((-h.vx*fy+h.vy*fx)/1400,-.3,.3)-h.roll)*Math.min(1,dt*4);
  h.spin+=((mine||h.z>gg+1?28:0)-h.spin)*Math.min(1,dt*1.2);
  if(mine){me.x=h.x;me.y=h.y;me.z=h.z;me.a=h.a;me.vx=me.vy=0}
}
function dropFlares(){const h=me.heli||me.jet;if(!h||h.falling||flareCd>0||state!=='play')return;flareCd=4;flareSeq++;
  for(let i=0;i<16;i++){const a=rand()*TAU,sp=60+rand()*140;parts.push({x:h.x,y:h.y,z0:h.z+6,vx:Math.cos(a)*sp+h.vx*.5,vy:Math.sin(a)*sp+h.vy*.5,life:2.4,max:2.4,col:'#ffd27a',k:'flare',sz:3})}
  for(const b of bullets)if(b.home&&b.home.peer===myPeer){b.home=null;b.vz=-80}noise(.4,3000,.2);feed('Flares away')}
function heliFire(){const h=me.heli;if(!h||h.falling||heliRocketCd>0)return;heliRocketCd=3;me.fireCd=.16;heliSide=-heliSide;
  const a=h.a,ox=h.x+Math.cos(a)*18-Math.sin(a)*13*heliSide,oy=h.y+Math.sin(a)*18+Math.cos(a)*13*heliSide,oz=h.z+8;
  let aa=a,slope=-.25;if(aimPt){const dx=aimPt[0]-ox,dy=aimPt[1]-oy,dh=Math.hypot(dx,dy);if(dh>10){aa=Math.atan2(dy,dx);slope=clamp((aimPt[2]-oz)/dh,-4,2)}}
  fireZ=oz;fireSpd=900;fireLife=2.4;fireSlope=slope;fire(ox,oy,aa,'me',0,true,false,null);bullets[bullets.length-1].heli=1;
  shotSeq=(shotSeq+1)%1e6;lastShot=[shotSeq,Math.round(ox),Math.round(oy),Math.round(aa*100)/100,WI.rpg,null,Math.round(oz),Math.round(slope*100)/100];
  fireZ=12;fireSpd=0;fireLife=0;fireSlope=0;shake=Math.max(shake,2)}

// ---------- fighter jets ----------
const RWX=9*B+R+(B-R)/2;
const JET_SPOTS=[-90,0,90].map(dx=>({x:RWX+dx,y:5*B+R+230}));
let jets=[],jetSide=1;
function spawnJet(i){const p=JET_SPOTS[i];return{i,x:p.x,y:p.y,z:0,a:-Math.PI/2,vz:0,vx:0,vy:0,speed:0,pitch:0,roll:0,hp:BAL.jetHp,dead:false,falling:false,deadT:0}}
function nearJet(){for(const j of jets)if(!j.dead&&!j.falling&&j.z<3&&me.jet!==j&&Math.hypot(j.x-me.x,j.y-me.y)<46&&(me.z||0)<10)return j;return null}
function jetStep(dt){
  if(!jets.length)jets=[0,1,2].map(spawnJet);
  for(let k=0;k<jets.length;k++){const j=jets[k],mine=me.jet===j;
    if(j.dead){j.deadT+=dt;const hd=Math.hypot(JET_SPOTS[j.i].x-A.x,JET_SPOTS[j.i].y-A.y);if(j.deadT>45&&hd>300){jets[k]=spawnJet(j.i);if(hd<2500)feed('A new fighter jet is ready at the airport')}continue}
    if(j.falling){j.vz-=380*dt;j.roll+=dt*4;j.x+=Math.cos(j.a)*j.speed*dt;j.y+=Math.sin(j.a)*j.speed*dt;j.z+=j.vz*dt;
      if(j.z<=heliGround(j.x,j.y)){j.dead=true;explode(j.x,j.y,mine,false,j.z);explode(j.x+25,j.y,mine,false,j.z);if(mine){me.jet=null;me.z=0;die('WASTED')}}continue}
    if(j.hp<=0){j.falling=true;j.vz=Math.min(j.vz,-40);if(mine)feed('Mayday! Your jet is going down');continue}
    const g=heliGround(j.x,j.y),air=j.z>g+1;let thr=0,climb=0;
    if(mine&&state==='play'){thr=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);if(stick.id!==null)thr=-stick.y;climb=(keys.Space||heliUpT?1:0)-(keys.ShiftLeft||keys.ShiftRight||heliDnT?1:0);
      const rate=air?1.15:(j.speed<80?1.4:.8),diff=wrap(look.yaw-j.a);j.a+=clamp(diff,-rate*dt,rate*dt);j.roll+=((air?clamp(diff*1.4,-1.1,1.1):0)-j.roll)*Math.min(1,dt*3)}
    else j.roll*=Math.pow(.1,dt);
    j.speed+=thr*(air?280:200)*dt;j.speed-=j.speed*(air?.04:.12)*dt;if(!air&&thr<=0)j.speed=Math.max(0,j.speed-90*dt);if(!mine&&!air)j.speed=Math.max(0,j.speed-150*dt);j.speed=clamp(j.speed,0,980);
    let tvz;if(air){tvz=climb*300;if(j.speed<200)tvz-=(200-j.speed)*1.6;if(!mine)tvz=-150}else tvz=climb>0&&j.speed>230?climb*220:0;
    j.vz+=(tvz-j.vz)*Math.min(1,dt*2.5);
    const nx=clamp(j.x+Math.cos(j.a)*j.speed*dt,-1800,W+1800),ny=clamp(j.y+Math.sin(j.a)*j.speed*dt,HILL.edge,W+1800);
    if(heliGround(nx,ny)>j.z+3){j.hp=0;j.falling=true;j.vz=-60;j.speed*=.3;if(mine)shake=Math.max(shake,14);continue}
    j.vx=(nx-j.x)/Math.max(dt,1e-4);j.vy=(ny-j.y)/Math.max(dt,1e-4);j.x=nx;j.y=ny;
    j.z=Math.min(1700,j.z+j.vz*dt);const gg=heliGround(j.x,j.y);if(j.z<gg){if(air&&j.vz<-170){j.hp-=Math.round(-j.vz*BAL.jetLandK);if(mine)shake=Math.max(shake,10)}j.z=gg;j.vz=Math.max(0,j.vz)}
    j.pitch+=(clamp(j.vz/420,-.55,.55)-j.pitch)*Math.min(1,dt*4);
    if(mine){me.x=j.x;me.y=j.y;me.z=j.z;me.a=j.a;me.vx=me.vy=0}}
}
function jetFire(){const j=me.jet;if(!j||j.falling)return;me.fireCd=.2;jetSide=-jetSide;
  const a=j.a,ox=j.x+Math.cos(a)*10-Math.sin(a)*16*jetSide,oy=j.y+Math.sin(a)*10+Math.cos(a)*16*jetSide,oz=j.z+5;
  let aa=a,slope=j.vz/Math.max(200,j.speed);if(aimPt){const dx=aimPt[0]-ox,dy=aimPt[1]-oy,dh=Math.hypot(dx,dy);if(dh>40&&Math.abs(wrap(Math.atan2(dy,dx)-a))<.9){aa=Math.atan2(dy,dx);slope=clamp((aimPt[2]-oz)/dh,-4,2)}}
  fireZ=oz;fireSpd=1300+j.speed;fireLife=2;fireSlope=slope;fire(ox,oy,aa,'me',0,true,false,null);bullets[bullets.length-1].jet=1;
  shotSeq=(shotSeq+1)%1e6;lastShot=[shotSeq,Math.round(ox),Math.round(oy),Math.round(aa*100)/100,WI.rpg,null,Math.round(oz),Math.round(slope*100)/100];
  fireZ=12;fireSpd=0;fireLife=0;fireSlope=0;shake=Math.max(shake,2)}

// ---------- white powder ----------
const DEALER={x:6*B+R+10,y:5*B+R+10};let powder=0,power=0,crashT=0;
const nearDealer=()=>!me.car&&!me.heli&&!me.jet&&!me.inside&&!me.roof&&Math.hypot(DEALER.x-me.x,DEALER.y-me.y)<30;
function buyPowder(){if(me.cash<200){feed('A bag costs $200');return}me.cash-=200;powder++;feed(`Bought a bag of white powder (${powder}). Press N to use it`);noise(.1,5000,.12);saveArsenal()}
function usePowder(){if(!powder||state!=='play'||power>0)return;powder--;power=25;crashT=0;noise(.5,5000,.18);showBig('SUPER STRENGTH','#f3ecff','25 seconds',1.4);feed('Your heart is racing. Run into cars and people');saveArsenal()}
function powerStep(dt){
  if(power>0){power-=dt;if(power<=0){power=0;crashT=10;feed('You are crashing...')}
    if(state==='play'&&!me.car&&!me.heli&&!me.jet&&!me.inside){
      for(const p of peds){if(p.down)continue;const d=Math.hypot(p.x-me.x,p.y-me.y);if(d<16){const nx=(p.x-me.x)/(d||1),ny=(p.y-me.y)/(d||1);knockPed(p,nx*520,ny*520,true)}}
      for(const c of cars){if(c.kind==='dead'||c.kind==='mine')continue;const d=Math.hypot(c.x-me.x,c.y-me.y);if(d<26&&!(c.shoveT>time)){c.shoveT=time+.6;if(c.kind==='traffic')wreck(c,true);if(c.kind==='police')c.mode='chase';
        const nx=(c.x-me.x)/(d||1),ny=(c.y-me.y)/(d||1);c.vx=(c.vx||0)+nx*420;c.vy=(c.vy||0)+ny*420;damageCar(c,BAL.shove,true);shake=Math.max(shake,6);noise(.3,500,.35)}}}}
  else if(crashT>0)crashT-=dt}

// ---------- robberies ----------
function startRob(p){if(rob)return;if(p.act==='heist'&&!unlocked('casinoHeist')){feed(`Come back at level ${UNLOCK.casinoHeist}`);return}const id=p.act+p.x;if((robCd[id]||0)>time){feed(`Nothing left to take. Come back in ${Math.ceil(robCd[id]-time)}s`);return}
  const big=p.act==='heist';rob={p,id,t:0,dur:big?12:6,cash:Math.round(big?rr(4000,6500):rr(700,1500)),heat:big?4:2};
  feed(big?'Heist started! Stay by the cage':'Robbery! Stay by the register');noise(.35,1500,.25)}
function robStep(dt){if(!rob)return;
  if(state!=='play'||!me.inside||Math.hypot(rob.p.x-me.x,rob.p.y-me.y)>60){feed('Robbery aborted');rob=null;return}
  rob.t+=dt;if(rob.t>=rob.dur){me.cash+=rob.cash;heat=Math.max(heat,rob.heat);coolT=0;robCd[rob.id]=time+180;showBig(rob.dur>8?'HEIST COMPLETE':'STORE ROBBED','#3dd68c',`+$${rob.cash}. The cops are on the way`,2.2);noise(.4,6000,.25);gainXP(rob.dur>8?250:80,rob.dur>8?'Casino cage':'Store robbery');saveArsenal();rob=null}}

// ---------- sticky bombs ----------
const stickies=[];let exSeq=0,lastEx=null;
function throwSticky(){if(stickies.length>=5){feed('Five bombs are out. Press G to detonate');return false}
  const c=me.car,a=c?c.a:look.yaw,sx=c?c.x:me.x,sy=c?c.y:me.y,sz=c?(c.z||0)+16:(me.z||0)+16,sp=c?240:330;
  stickies.push({x:sx+Math.cos(a)*14,y:sy+Math.sin(a)*14,z:sz,vx:Math.cos(a)*sp+(c?c.vx:0),vy:Math.sin(a)*sp+(c?c.vy:0),vz:150,stuck:null,t:0});gunSnd('sticky',sx,sy);return true}
function stickTo(o,s,nx,ny,a){const dx=nx-o.x,dy=ny-o.y,ca=Math.cos(-a),sa=Math.sin(-a);return{ox:dx*ca-dy*sa,oy:dx*sa+dy*ca}}
function stickyStep(dt){
  for(const s of stickies){s.t+=dt;
    if(!s.stuck){s.vz-=520*dt;const nx=s.x+s.vx*dt,ny=s.y+s.vy*dt,nz=s.z+s.vz*dt;
      for(const c of cars){if(c===me.car||c.kind==='dead')continue;const T=ctOf(c);if(Math.hypot(c.x-nx,c.y-ny)<T.len/2&&nz<(c.z||0)+T.h+10){s.stuck=Object.assign({car:c},stickTo(c,s,nx,ny,c.a));s.z=(c.z||0)+T.h+5;noise(.06,4000,.1);break}}
      if(!s.stuck)for(const[peer,r]of remotes){if(r.dead||!r.inCar)continue;if(Math.hypot(r.x-nx,r.y-ny)<24&&nz<24){s.stuck=Object.assign({peer},stickTo(r,s,nx,ny,r.a));s.z=(r.inCar?r.cz||0:r.z||0)+14;feed(`Bomb stuck to ${r.name}'s car`);break}}
      if(!s.stuck){if(solidAt(nx,ny,nz))s.stuck='wall';else if(nz<=groundZ(nx,ny)+1){s.x=nx;s.y=ny;s.z=groundZ(nx,ny)+1;s.stuck='ground'}else{s.x=nx;s.y=ny;s.z=nz}}}
    else if(s.stuck.car){const c=s.stuck.car;if(!cars.includes(c)){s.stuck='ground';s.z=groundZ(s.x,s.y)+1}else{const ca=Math.cos(c.a),sa=Math.sin(c.a);s.x=c.x+s.stuck.ox*ca-s.stuck.oy*sa;s.y=c.y+s.stuck.ox*sa+s.stuck.oy*ca;s.z=(c.z||0)+ctOf(c).h+5}}
    else if(s.stuck.peer){const r=remotes.get(s.stuck.peer);if(!r||r.dead){s.stuck='ground';s.z=groundZ(s.x,s.y)+1}else{const ca=Math.cos(r.a),sa=Math.sin(r.a);s.x=r.x+s.stuck.ox*ca-s.stuck.oy*sa;s.y=r.y+s.stuck.ox*sa+s.stuck.oy*ca}}
  }
}
function detonate(){if(!stickies.length||state==='menu')return;const pts=[];for(const b of stickies){explode(b.x,b.y,true,false,Math.max(groundZ(b.x,b.y),b.z),1,b.stuck);pts.push(Math.round(b.x),Math.round(b.y))}stickies.length=0;exSeq++;lastEx=[exSeq,...pts]}

// ---------- blackjack ----------
const SUITS=['♠','♥','♦','♣'],RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const BJMIN=10,BJMAX=5000,BJCUT=234,BJN={hit:'Hit',stand:'Stand',double:'Double',split:'Split',surr:'Surrender'};
let tableK=1;
// Basic strategy: dealer stands on all 17s, double on any two cards, split up to 3 times, late surrender.
// Columns are dealer upcards 2..A. H hit, S stand, D double else hit, d double else stand, R surrender else hit, P split.
const BJHARD={9:'HDDDDHHHHH',10:'DDDDDDDDHH',11:'DDDDDDDDDH',12:'HHSSSHHHHH',13:'SSSSSHHHHH',14:'SSSSSHHHHH',15:'SSSSSHHHRH',16:'SSSSSHHRRR'};
const BJSOFT={2:'HHHDDHHHHH',3:'HHHDDHHHHH',4:'HHDDDHHHHH',5:'HHDDDHHHHH',6:'HDDDDHHHHH',7:'dDDDDSSHHH',8:'SSSSSSSSSS',9:'SSSSSSSSSS'};
const BJPAIR={11:'PPPPPPPPPP',10:'SSSSSSSSSS',9:'PPPPPSPPSS',8:'PPPPPPPPPP',7:'PPPPPPHHHH',6:'PPPPPHHHHH',4:'HHHPPHHHHH',3:'PPPPPPHHHH',2:'PPPPPPHHHH'};
const PIPS={2:[[50,20],[50,80]],3:[[50,20],[50,50],[50,80]],4:[[30,20],[70,20],[30,80],[70,80]],5:[[30,20],[70,20],[50,50],[30,80],[70,80]],6:[[30,20],[70,20],[30,50],[70,50],[30,80],[70,80]],7:[[30,20],[70,20],[50,35],[30,50],[70,50],[30,80],[70,80]],8:[[30,20],[70,20],[50,35],[30,50],[70,50],[50,65],[30,80],[70,80]],9:[[30,17],[70,17],[30,39],[70,39],[50,50],[30,61],[70,61],[30,83],[70,83]],10:[[30,17],[70,17],[50,28],[30,39],[70,39],[30,61],[70,61],[50,72],[30,83],[70,83]]};
const money=v=>'$'+Math.round(v).toLocaleString('en-US');
const wait=ms=>new Promise(r=>setTimeout(r,reduced?0:ms));
function countUp(el,a,b,ms,fmt){return new Promise(res=>{const t0=performance.now(),f=t=>{const k=reduced?1:Math.min(1,(t-t0)/ms);el.textContent=(fmt||money)(a+(b-a)*(1-(1-k)**3));if(k<1)requestAnimationFrame(f);else res()};requestAnimationFrame(f)})}
// chips and chip stacks; fly() slides an element from rect a to rect b
function chipEl(v,i){const c=document.createElement('i');c.className='cx c'+v;if(i!=null)c.style.bottom=i*4+'px';return c}
function chipStack(a){const s=document.createElement('div');s.className='stk';let i=0;for(const v of[1000,500,100,50,10])while(a>=v&&i<12){s.appendChild(chipEl(v,i++));a-=v}return s}
function fly(el,a,b,ms,delay){return el.animate([{transform:'translate(0,0)'},{transform:`translate(${b.left-a.left}px,${b.top-a.top}px)`}],{duration:ms,delay:delay||0,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'})}
// shoe and hand maths. Cards are {r, su}. Shared by the table and bjSim.
function bjNewShoe(){const c=[];for(let k=0;k<6;k++)for(const su of SUITS)for(const r of RANKS)c.push({r,su});for(let i=c.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[c[i],c[j]]=[c[j],c[i]]}return{c,used:0}}
const bjTake=sh=>(sh.used++,sh.c.pop());
const bjPip=c=>c.r==='A'?11:'JQK'.includes(c.r)?10:+c.r;
function bjVal(cs){let v=0,a=0;for(const c of cs){v+=bjPip(c);if(c.r==='A')a++}while(v>21&&a){v-=10;a--}return v}
const bjHard=cs=>cs.reduce((s,c)=>s+(c.r==='A'?1:bjPip(c)),0);
const bjNat=cs=>cs.length===2&&bjVal(cs)===21;
const bjUp=c=>c.r==='A'?9:bjPip(c)===10?8:bjPip(c)-2;
// action for hand h against upcard index ui: hit, stand, double, split or surr
function bjStrat(h,ui,r){const cs=h.c,two=cs.length===2,hard=bjHard(cs);let t;
  if(two&&cs[0].r===cs[1].r&&r.h.length<4)t=(BJPAIR[bjPip(cs[0])]||'')[ui];
  if(!t){const soft=hard+10<21&&hard>=3&&cs.some(c=>c.r==='A');t=soft?BJSOFT[hard-1][ui]:hard>=17?'S':hard<=8?'H':BJHARD[hard][ui]}
  return{H:'hit',S:'stand',D:two?'double':'hit',d:two?'double':'stand',R:two&&r.h.length===1?'surr':'hit',P:'split'}[t]}
// a round: r.h hands {c, bet, sp, done, surr, win, res}, r.i active hand, r.d dealer cards, r.ins insurance, r.stake money in, r.back money out
function bjNewRound(bet,draw){const h={c:[],bet,sp:0,done:0,surr:0,win:0,res:''};const r={h:[h],i:0,d:[],ins:0,stake:bet,back:0};h.c.push(draw());r.d.push(draw());h.c.push(draw());r.d.push(draw());return r}
const bjChk=h=>{if(bjVal(h.c)>=21)h.done=1};
function bjHit(r,draw){const h=r.h[r.i];h.c.push(draw());bjChk(h)}
function bjDbl(r,draw){const h=r.h[r.i];r.stake+=h.bet;h.bet*=2;h.c.push(draw());h.done=1}
function bjSplit(r,draw){const h=r.h[r.i],ace=h.c[0].r==='A',n={c:[h.c.pop()],bet:h.bet,sp:1,done:0,surr:0,win:0,res:''};
  h.sp=1;r.h.splice(r.i+1,0,n);r.stake+=h.bet;h.c.push(draw());n.c.push(draw());if(ace)h.done=n.done=1;bjChk(h);bjChk(n)}
function bjSurr(r){const h=r.h[r.i];h.surr=1;h.done=1}
function bjStand(r){r.h[r.i].done=1}
function bjNext(r){for(;r.i<r.h.length;r.i++)if(!r.h[r.i].done)return true;return false}
function bjDealer(r,draw){if(r.h.length===1&&bjNat(r.h[0].c)||!r.h.some(h=>!h.surr&&bjVal(h.c)<=21))return;while(bjVal(r.d)<17)r.d.push(draw())}
// sets h.win and h.res for each hand, adds insurance, returns total money back
function bjPay(r){const dv=bjVal(r.d),dn=bjNat(r.d),one=r.h.length===1;let back=dn?r.ins*3:0;
  for(const h of r.h){const pv=bjVal(h.c),pn=one&&bjNat(h.c),b=h.bet;let k,t;
    if(h.surr){k=.5;t='Surrender'}
    else if(pv>21){k=0;t='Bust'}
    else if(pn&&dn){k=1;t='Push'}
    else if(pn){k=2.5;t='Blackjack'}
    else if(dn){k=0;t='Dealer blackjack'}
    else if(dv>21||pv>dv){k=2;t='Win'}
    else if(pv===dv){k=1;t='Push'}
    else{k=0;t='Lose'}
    h.win=k*b;h.res=t;back+=h.win}
  r.back=back;return back}
// bjSim(n): n hands of basic strategy, no animation. Returns the player's return (money back / money staked).
function bjSim(n){let sh=bjNewShoe(),st=0,bk=0;const draw=()=>bjTake(sh);
  for(let k=0;k<n;k++){if(sh.used>=BJCUT)sh=bjNewShoe();const r=bjNewRound(BJMIN,draw);
    if(!(r.h.length===1&&bjNat(r.h[0].c))&&!bjNat(r.d))
      while(bjNext(r)){const a=bjStrat(r.h[r.i],bjUp(r.d[0]),r);
        if(a==='hit')bjHit(r,draw);else if(a==='stand')bjStand(r);else if(a==='double')bjDbl(r,draw);else if(a==='split')bjSplit(r,draw);else bjSurr(r)}
    bjDealer(r,draw);st+=r.stake;bk+=bjPay(r)}
  return bk/st}
// table state. ph: bet, ins (insurance offer), play, reveal, done
const bj={sh:bjNewShoe(),r:null,ph:'bet',bet:0,last:0,msg:'Place your bet.',busy:0,open:0,hint:0,counting:0,n:0,seen:new WeakSet()};
function bjDraw(){noise(.05,6000,.08);const c=bjTake(bj.sh);c.n=++bj.n;return c}
function bjFaceHTML(c){const tl=`<i class=ix>${c.r}<b>${c.su}</b></i>`,br=`<i class="ix bt">${c.r}<b>${c.su}</b></i>`;
  if('JQK'.includes(c.r))return tl+br+`<em class=fc>${c.r}</em><em class=fs>${c.su}</em>`;
  if(c.r==='A')return tl+br+`<em class=pa>${c.su}</em>`;
  return tl+br+PIPS[bjPip(c)].map(([x,y])=>`<em class="p${y>50?' u':''}" style="left:${x}%;top:${y}%">${c.su}</em>`).join('')}
function bjCard(c,down){const e=document.createElement('div');e.className='pc';const red=c.su==='♥'||c.su==='♦';
  e.innerHTML=`<div class="pi${down?' fd':''}"><div class="face${red?' red':''}">${bjFaceHTML(c)}</div><div class="bk"></div></div>`;return e}
function bjShow(c,down){const e=bjCard(c,down);if(!bj.seen.has(c)){bj.seen.add(c);e.dataset.new=c.n||0}return e}
// new cards fly from the shoe, in the order they were drawn
function bjFlyIn(){const s=$('bjShoe').getBoundingClientRect(),sx=s.left+s.width/2,sy=s.top+s.height/2;
  const nw=[...$('bj').querySelectorAll('[data-new]')].sort((a,b)=>a.dataset.new-b.dataset.new);
  nw.forEach((el,i)=>{el.removeAttribute('data-new');const r=el.getBoundingClientRect(),dx=sx-(r.left+r.width/2),dy=sy-(r.top+r.height/2);
    el.animate([{transform:`translate(${dx}px,${dy}px) rotate(-10deg) scale(.8)`,opacity:0},{transform:'none',opacity:1}],{duration:480,delay:reduced?0:i*180,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'})})}
function bjHandEl(h,i,n){const b=document.createElement('div');b.className='bjHand'+(h&&bj.ph==='play'&&bj.r.i===i?' act':'');
  const hd=document.createElement('div');hd.className='hand n'+(n>=4?4:n);if(h)h.c.forEach(c=>hd.appendChild(bjShow(c,false)));
  const tot=document.createElement('b');tot.className='bjTot';if(h&&h.c.length){const v=bjVal(h.c);tot.textContent=v>21?'Bust':v}
  const sp=document.createElement('div');sp.className='bjSpot';sp.dataset.t=h?'':'Bet here';const amt=h?h.bet:bj.bet;if(amt)sp.appendChild(chipStack(amt));
  const rs=document.createElement('div');rs.className='bjRes';
  if(h&&h.res){const net=h.win-h.bet;rs.textContent=h.res+(net>0?' +'+money(net):net<0?' -'+money(-net):'');if(net)rs.classList.add(net>0?'win':'lose')}
  if(h)b.append(hd);b.append(tot,sp,rs);return b}
function bjRender(){
  const ph=bj.ph,r=ph==='bet'?null:bj.r,hide=!bj.open&&(ph==='play'||ph==='ins'||ph==='reveal');
  if(!bj.counting)$('bjCash').textContent=money(me.cash);
  $('bjLim').textContent=`${money(BJMIN)} to ${money(BJMAX*tableK)}`;$('bjT').textContent=tableK>1?'High-limit blackjack':'Blackjack';
  $('bjLeft').textContent=bj.sh.used>=BJCUT?'Cut card out, reshuffle next hand':`${BJCUT-bj.sh.used} cards to the cut`;
  $('bjShoe').classList.toggle('cut',bj.sh.used>=BJCUT);
  const D=$('bjD');D.replaceChildren();if(r)r.d.forEach((c,i)=>D.appendChild(bjShow(c,hide&&i===1)));
  $('bjDv').textContent=!r?'':hide?String(bjVal([r.d[0]])):String(bjVal(r.d));
  const P=$('bjP');P.replaceChildren();if(!r)P.appendChild(bjHandEl(null,0,0));else r.h.forEach((h,i)=>P.appendChild(bjHandEl(h,i,r.h.length)));
  bjFlyIn();
  const act=ph==='play'&&!bj.busy?r.h[r.i]:null,hintA=bj.hint&&act?bjStrat(act,bjUp(r.d[0]),r):'';
  $('bjHint').textContent=hintA?`Basic strategy: ${BJN[hintA]}`:'';
  $('bjHintT').textContent=bj.hint?'Hints on':'Hints off';
  $('bjMsg').textContent=bj.msg;
  const Bt=$('bjBtns');Bt.replaceChildren();const cash=me.cash;
  const btn=(t,fn,dis,cls,a)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.disabled=!!dis||!!bj.busy;if(cls)b.className=cls;if(a){b.dataset.a=a;if(a===hintA)b.classList.add('hint')}b.onclick=()=>fn(b);Bt.appendChild(b);return b};
  if(ph==='bet'){for(const v of[10,50,100,500])btn('+$'+v,b=>bjChip(v,b),bj.bet+v>Math.min(BJMAX*tableK,cash),'chip');btn('Clear',()=>{bj.bet=0;bjRender()},!bj.bet);btn(`Deal ${money(bj.bet)}`,bjDeal,bj.bet<BJMIN||bj.bet>cash,'go')}
  else if(ph==='ins'){const a=Math.floor(r.h[0].bet/2);btn(`Insurance ${money(a)}`,()=>bjIns(1),a>cash,'chip');btn('No insurance',()=>bjIns(0))}
  else if(ph==='play'){const h=r.h[r.i],ok=h.c.length===2,pr=cash>=h.bet;
    btn('Hit',()=>bjAct('hit'),false,'go','hit');btn('Stand',()=>bjAct('stand'),false,'','stand');
    btn('Double',()=>bjAct('double'),!ok||!pr,'','double');
    btn('Split',()=>bjAct('split'),!(ok&&h.c[0].r===h.c[1].r&&r.h.length<4&&pr),'','split');
    btn('Surrender',()=>bjAct('surr'),!(ok&&r.h.length===1&&!h.sp),'','surr')}
  else if(ph==='done'){btn(`Same bet ${money(bj.last)}`,()=>{bj.ph='bet';bj.bet=bj.last;bjDeal()},bj.last<BJMIN||bj.last>cash,'go');
    btn('Change bet',()=>{bj.ph='bet';bj.bet=0;bj.r=null;bj.open=0;bj.msg='Place your bet.';bjRender()})}
}
function bjChip(v,b){if(bj.ph!=='bet')return;const f=b.getBoundingClientRect();bj.bet+=v;bjRender();
  const s=$('bjP').querySelector('.bjSpot');if(!s)return;const t=s.getBoundingClientRect(),el=chipEl(v);
  el.style.cssText=`position:fixed;z-index:9;left:${f.left}px;top:${f.top}px`;document.body.append(el);fly(el,f,t,320).onfinish=()=>el.remove();noise(.04,6000,.06)}
async function bjDeal(){
  if(bj.ph!=='bet'||bj.busy||bj.bet<BJMIN||bj.bet>BJMAX*tableK||bj.bet>me.cash)return;
  if(bj.sh.used>=BJCUT)bj.sh=bjNewShoe();
  bj.busy=1;me.cash-=bj.bet;bj.last=bj.bet;bj.open=0;bj.r=bjNewRound(bj.bet,bjDraw);bj.ph='play';bj.msg='';
  if(bj.r.d[0].r==='A'){bj.ph='ins';bj.msg='Dealer shows an ace. Insurance pays 2 to 1.'}
  bjRender();await wait(1000);bj.busy=0;
  if(bj.ph==='ins'){bjRender();return}
  if(bj.ph!=='play')return;
  if(bjNat(bj.r.d)||bjNat(bj.r.h[0].c))await bjSettle();else bjRender()}
async function bjIns(take){if(bj.ph!=='ins')return;const r=bj.r,a=Math.floor(r.h[0].bet/2);
  if(take&&a<=me.cash){me.cash-=a;r.ins=a;r.stake+=a}
  bj.ph='play';bj.msg=r.ins?'Insurance bought.':'No insurance.';
  if(bjNat(r.d)||bjNat(r.h[0].c)){await bjSettle();return}
  bjRender()}
async function bjAct(a){if(bj.ph!=='play'||bj.busy)return;const r=bj.r,s0=r.stake;
  if(a==='hit')bjHit(r,bjDraw);else if(a==='stand')bjStand(r);else if(a==='double')bjDbl(r,bjDraw);else if(a==='split')bjSplit(r,bjDraw);else bjSurr(r);
  me.cash-=r.stake-s0;noise(.05,6000,.07);bj.busy=1;bjRender();await wait(520);bj.busy=0;
  if(bj.ph!=='play')return;
  if(bjNext(r))bjRender();else await bjSettle()}
// the dealer turns the hole card, draws, then pays out
async function bjSettle(){if(bj.ph==='reveal'||bj.ph==='done')return;const r=bj.r;bj.ph='reveal';bj.busy=1;bjRender();
  await wait(350);bj.open=1;$('bjD').querySelector('.pi.fd')?.classList.remove('fd');
  await wait(600);bjDealer(r,bjDraw);bjRender();await wait(900);
  const back=bjPay(r),net=back-r.stake;me.cash+=back;bj.ph='done';bj.busy=1;bj.counting=1;
  bjRender();bjFlights(r);
  bj.msg=r.h.map(h=>h.res).join(' · ')+(net>0?' +'+money(net):net<0?' -'+money(-net):'');
  if(net>0){jingle(net>=500?'level':'pass');if(net>=500)feed(`Big win at blackjack: +${money(net)}`)}else tone('triangle',180,.35,.1);
  await countUp($('bjCash'),me.cash-back,me.cash,800);
  bj.counting=0;bj.busy=0;bj.bet=bj.last;saveArsenal();bjRender()}
// payout chips slide from the rack to winners, losing bets slide back to the rack
function bjFlights(r){const rk=$('bjRack').getBoundingClientRect(),sp=$('bj').querySelectorAll('.bjSpot');
  r.h.forEach((h,i)=>{const st=sp[i]&&sp[i].querySelector('.stk');if(!st)return;
    if(h.win>h.bet){const p=chipStack(h.win-h.bet);p.style.cssText='position:fixed;z-index:9';p.style.left=rk.left+'px';p.style.top=rk.top+'px';document.body.append(p);fly(p,rk,st.getBoundingClientRect(),700,i*120).onfinish=()=>p.remove()}
    else if(h.win===0){fly(st,st.getBoundingClientRect(),rk,650,150);st.animate([{opacity:1},{opacity:0}],{duration:650,delay:150,fill:'forwards'})}})}
// closing the table mid-hand stands every hand and pays out at once
function bjLeave(){if(bj.ph!=='play'&&bj.ph!=='ins')return;const r=bj.r;for(const h of r.h)h.done=1;bj.open=1;bjDealer(r,bjDraw);me.cash+=bjPay(r);bj.ph='done';bj.busy=0;bj.counting=0;bj.bet=bj.last;saveArsenal()}
function openBJ(k=1){tableK=k;try{document.exitPointerLock&&document.exitPointerLock()}catch(_){}mouse.down=false;state='shop';if(bj.ph==='bet')bj.bet=Math.min(bj.bet,BJMAX*k,me.cash);$('bj').hidden=false;bjRender()}
$('bjClose').addEventListener('click',()=>closeShop());
$('bjHintT').addEventListener('click',()=>{bj.hint=bj.hint?0:1;bjRender()});
if(DBG)Object.defineProperties(DBG,{bj:{get:()=>bj}});

// ---------- VIP booth ----------
function startLap(){if(lap)return;if(me.cash<100){feed('A private dance costs $100');return}me.cash-=100;lap={t:0,dur:20};state='cut';me.vx=me.vy=0;me.x=club.ox+386;me.y=club.oy+305;me.a=-Math.PI/2;mouse.down=false;
  try{document.exitPointerLock&&document.exitPointerLock()}catch(_){}feed('Sit back and enjoy the show. Esc to leave early');noise(.2,4000,.12)}
function endLap(){if(!lap)return;lap=null;state='play';me.y=club.oy+262;me.hp=Math.min(BAL.playerHp,me.hp+15);feed('Worth every dollar. +15 health')}

// ---------- modals ----------
function openModal(id){try{document.exitPointerLock&&document.exitPointerLock()}catch(_){}mouse.down=false;state='shop';$(id).hidden=false}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeShop()));
function mkBtn(parent,label,fn,cls,dis){const b=document.createElement('button');b.type='button';b.className='b'+(cls?' '+cls:'');b.textContent=label;b.disabled=!!dis;b.addEventListener('click',fn);parent.appendChild(b);return b}
function casinoAct(p){if(p.act==='roulette'){tableK=1;openModal('roul');renderRoul();return true}
  if(p.act==='wheel'){openLucky();return true}
  if(p.act==='rocket'){openRocket();return true}
  if(p.act==='poker'){openTCP();return true}
  if(p.act==='horse'){openHorses();return true}
  if(p.act==='hlbj'){if(hlGate())openBJ(10);return true}
  if(p.act==='hlro'){if(hlGate()){tableK=10;openModal('roul');renderRoul()}return true}
  if(p.act==='slots'){tableK=1;openModal('slots');casinoOpenSlots();return true}
  if(p.act==='slots7'){tableK=1;openModal('slots7');s7.skip=false;s7UI();slStart();$('s7Act').querySelector('.go')?.focus();return true}return false}

// ---------- roulette ----------
const RO_ORDER=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const REDS=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const RO_MAX=10000,RO_CHIPS=[10,50,100,500,1000],RR=(a,b)=>Array.from({length:Math.max(0,b-a+1)},(_,i)=>a+i),md=x=>((x%TAU)+TAU)%TAU;
// bet keys: n<num> straight, s<a>-<b> split, t<a> street, q<a> corner, l<a> six line, d1-d3 dozens, c1-c3 columns, red black odd even low high
const ROCV={};
function roCov(k){let c=ROCV[k];if(!c){const a=+k.slice(1),all=RR(1,36),o={red:[...REDS],black:all.filter(n=>!REDS.has(n)),odd:all.filter(n=>n%2),even:all.filter(n=>n%2===0),low:RR(1,18),high:RR(19,36)};
  c=o[k]||({n:[a],s:k.slice(1).split('-').map(Number),t:RR(a,a+2),q:[a,a+1,a+3,a+4],l:RR(a,a+5),d:RR((a-1)*12+1,a*12),c:all.filter(n=>n%3===a%3)})[k[0]];ROCV[k]=c}return c}
const roHit=(k,n)=>roCov(k).includes(n),roMult=k=>36/roCov(k).length;
// money back (stake included) for bets {key: amount} on winning number n. Used by the table and by rouletteRTP.
function roPay(bets,n){let w=0;for(const k in bets)if(roHit(k,n))w+=bets[k]*roMult(k);return w}
// board in cell units: 13 columns (zero, then 12 number columns) by 3 rows. Each inside bet has an anchor point.
const RX=n=>Math.ceil(n/3)+.5,RY=n=>n%3===1?2.5:n%3===2?1.5:.5;
const RO_ANC={n0:[.5,1.5],'s0-1':[1,2.5],'s0-2':[1,1.5],'s0-3':[1,.5]};
for(let n=1;n<=36;n++)RO_ANC['n'+n]=[RX(n),RY(n)];
for(let n=1;n<=33;n++)RO_ANC[`s${n}-${n+3}`]=[Math.ceil(n/3)+1,RY(n)];
for(let n=1;n<=35;n++)if(n%3)RO_ANC[`s${n}-${n+1}`]=[RX(n),(RY(n)+RY(n+1))/2];
for(let a=1;a<=32;a++)if(a%3)RO_ANC['q'+a]=[Math.ceil(a/3)+1,(RY(a)+RY(a+1))/2];
for(let c=1;c<=12;c++)RO_ANC['t'+(3*c-2)]=[c+.5,3];
for(let c=1;c<=11;c++)RO_ANC['l'+(3*c-2)]=[c+1,3];
const RO_OUT=['red','black','odd','even','low','high','d1','d2','d3','c1','c2','c3'],RO_KEYS=[...Object.keys(RO_ANC),...RO_OUT];
// nearest anchor to a point in cell units, within 0.9 cells
function roNear(x,y){let best,bd=.9;for(const k in RO_ANC){const d=Math.hypot(RO_ANC[k][0]-x,RO_ANC[k][1]-y);if(d<bd){bd=d;best=k}}return best}
function roPick(e){const p=$('rNums').getBoundingClientRect();return roNear((e.clientX-p.left)/p.width*13,(e.clientY-p.top)/p.height*3)}
// wheel: drawn once, then rotated each frame with the ball on top
const RWH=document.createElement('canvas');RWH.width=RWH.height=400;
{const g=RWH.getContext('2d'),seg=TAU/37;g.translate(200,200);
 g.fillStyle='#4a2e18';g.beginPath();g.arc(0,0,199,0,TAU);g.fill();
 g.fillStyle='#c9a24a';g.beginPath();g.arc(0,0,192,0,TAU);g.fill();
 for(let i=0;i<37;i++){const n=RO_ORDER[i],a0=-Math.PI/2+i*seg-seg/2;g.fillStyle=n===0?'#1f8a4c':REDS.has(n)?'#b3202f':'#16121f';
   g.beginPath();g.arc(0,0,186,a0,a0+seg);g.arc(0,0,130,a0+seg,a0,true);g.closePath();g.fill();
   g.strokeStyle='#e9d28a';g.lineWidth=1.5;g.beginPath();g.moveTo(Math.cos(a0)*130,Math.sin(a0)*130);g.lineTo(Math.cos(a0)*186,Math.sin(a0)*186);g.stroke();
   g.save();g.rotate(a0+seg/2+Math.PI/2);g.fillStyle='#fff';g.font='700 19px sans-serif';g.textAlign='center';g.fillText(String(n),0,-160);g.restore()}
 const cone=g.createRadialGradient(0,0,10,0,0,118);cone.addColorStop(0,'#5b3d22');cone.addColorStop(1,'#1d140c');
 g.fillStyle=cone;g.beginPath();g.arc(0,0,118,0,TAU);g.fill();
 const hub=g.createRadialGradient(-6,-6,2,0,0,24);hub.addColorStop(0,'#fff3b8');hub.addColorStop(1,'#c58d1b');
 g.fillStyle=hub;g.beginPath();g.arc(0,0,24,0,TAU);g.fill()}
// ball radius over t (0..1): rides the rim, drops into the pocket ring with bounces, settles
function roR(t){if(t<.55)return 182;if(t<.8){const s=(t-.55)/.25;return 146+36*(1-s)**2+5*Math.abs(Math.sin(3*Math.PI*s))*(1-s)}const s=(t-.8)/.2;return 146+3*Math.abs(Math.sin(4*Math.PI*s))*(1-s)}
const ro={chip:10,bets:{},lastBets:null,spinning:false,sw:0,a:0,b:null,r:182,hist:[],ob:{},msg:'Pick a chip, then tap the table to bet.'};
function roDraw(){const g=$('rwheel').getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,400,400);
  g.translate(200,200);g.rotate(ro.a);g.drawImage(RWH,-200,-200);g.rotate(-ro.a);
  if(ro.b!=null){const x=Math.cos(ro.b)*ro.r,y=Math.sin(ro.b)*ro.r;
    g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.arc(x+2,y+4,9,0,TAU);g.fill();
    const gr=g.createRadialGradient(x-3,y-3,1,x,y,9);gr.addColorStop(0,'#ffffff');gr.addColorStop(1,'#b9b4c9');
    g.fillStyle=gr;g.beginPath();g.arc(x,y,8,0,TAU);g.fill()}}
// board DOM is built once. Number cells are divs (not buttons) so clicks use the pointer position.
const RO_CELL={};
{const N=$('rNums');RO_CELL[0]=$('rZero');
 for(let n=1;n<=36;n++){const b=document.createElement('div');b.className='cell '+(REDS.has(n)?'r':'k');b.textContent=n;
   b.style.gridColumn=String(Math.ceil(n/3)+1);b.style.gridRow=String(n%3===0?1:n%3===2?2:3);RO_CELL[n]=b;N.appendChild(b)}
 N.addEventListener('click',e=>{const k=roPick(e);if(k)roBet(k)});
 N.addEventListener('contextmenu',e=>{e.preventDefault();const k=roPick(e);if(k)roPull(k)});
 N.addEventListener('pointermove',e=>{const k=roPick(e),h=$('rHov');h.hidden=!k;if(k){h.style.left=RO_ANC[k][0]/13*100+'%';h.style.top=RO_ANC[k][1]/3*100+'%'}});
 N.addEventListener('pointerleave',()=>{$('rHov').hidden=true});
 const outBtn=(parent,k,l,cls)=>{const b=document.createElement('button');b.type='button';b.className='ob '+(cls||'');b.textContent=l;b.onclick=()=>roBet(k);b.oncontextmenu=e=>{e.preventDefault();roPull(k)};parent.appendChild(b);ro.ob[k]=b};
 for(const[k,l,c]of[['red','Red','r'],['black','Black','k'],['odd','Odd',''],['even','Even',''],['low','1–18',''],['high','19–36','']])outBtn($('rOut'),k,l,c);
 for(const[k,l]of[['d1','1st 12'],['d2','2nd 12'],['d3','3rd 12']])outBtn($('rDoz'),k,l);
 for(const[k,l]of[['c3','2:1'],['c2','2:1'],['c1','2:1']])outBtn($('rCols'),k,l)}
const roTotal=()=>Object.values(ro.bets).reduce((a,b)=>a+b,0);
function roBet(k){if(ro.spinning||ro.sw)return;if(me.cash<ro.chip){ro.msg='Not enough cash for that chip.';renderRoul();return}
  if(roTotal()+ro.chip>RO_MAX*tableK){ro.msg=`Table limit is ${money(RO_MAX*tableK)} a spin.`;renderRoul();return}
  me.cash-=ro.chip;ro.bets[k]=(ro.bets[k]||0)+ro.chip;noise(.04,6000,.06);ro.msg='';renderRoul()}
// right-click takes the selected chip value back from a spot
function roPull(k){if(ro.spinning||ro.sw||!ro.bets[k])return;const a=Math.min(ro.chip,ro.bets[k]);ro.bets[k]-=a;me.cash+=a;if(!ro.bets[k])delete ro.bets[k];noise(.03,4000,.05);renderRoul()}
function roClear(){if(ro.spinning||ro.sw)return;for(const k in ro.bets)me.cash+=ro.bets[k];ro.bets={};renderRoul()}
function roRebet(){if(!ro.lastBets||ro.spinning||ro.sw)return;roClear();const tot=Object.values(ro.lastBets).reduce((a,b)=>a+b,0);if(tot>me.cash){ro.msg='Not enough cash to repeat.';renderRoul();return}me.cash-=tot;ro.bets={...ro.lastBets};renderRoul()}
function roDouble(){if(ro.spinning||ro.sw)return;const tot=roTotal();if(!tot)return;if(tot*2>RO_MAX*tableK){ro.msg=`Table limit is ${money(RO_MAX*tableK)} a spin.`;renderRoul();return}if(tot>me.cash){ro.msg='Not enough cash to double.';renderRoul();return}me.cash-=tot;for(const k in ro.bets)ro.bets[k]*=2;renderRoul()}
function roSpin(){if(ro.spinning)return;if(!roTotal()){ro.msg='Place a bet first.';renderRoul();return}
  if(roTotal()>RO_MAX*tableK){ro.msg=`Table limit is ${money(RO_MAX*tableK)} a spin.`;renderRoul();return}
  ro.spinning=true;ro.lastBets={...ro.bets};ro.msg='No more bets...';renderRoul();noise(1.4,900,.08);
  // decide the pocket first, then animate the wheel and ball to end with that pocket under the marker at the top
  const n=Math.floor(rand()*37),i=RO_ORDER.indexOf(n),w0=ro.a,dW=TAU*3+md(-i*TAU/37-w0),b0=-Math.PI/2+(rand()-.5)*.6*TAU/37,dB=TAU*6,T=reduced?1200:5000,t0=performance.now();
  const f=now=>{const t=Math.min(1,(now-t0)/T),e=1-(1-t)**3;ro.a=w0+dW*e;ro.b=b0+dB*(1-e);ro.r=roR(t);roDraw();if(t<1)requestAnimationFrame(f);else roDone(n)};
  requestAnimationFrame(f)}
function roDone(n){
  const tot=roTotal(),pay=roPay(ro.bets,n),net=pay-tot;
  ro.hist.unshift(n);if(ro.hist.length>100)ro.hist.length=100;
  ro.sw=1;const cell=RO_CELL[n];cell.classList.add('hit');
  // losing chips slide into the dealer's rake, winning chips glow
  const rk=$('rRake').getBoundingClientRect();
  for(const el of $('rBoard').querySelectorAll('.stk[data-k]')){
    if(roHit(el.dataset.k,n))el.classList.add('won');
    else{fly(el,el.getBoundingClientRect(),rk,650,250);el.animate([{opacity:1},{opacity:0}],{duration:650,delay:250,fill:'forwards'})}}
  const before=me.cash;me.cash+=pay;saveArsenal();
  if(net>0){jingle(net>=5000?'level':'pass');if(net>=5000)feed(`Roulette win: +${money(net)}`)}
  countUp($('rCash'),before,me.cash,900,v=>'Cash '+money(v));
  ro.msg=`${n} ${n===0?'green':REDS.has(n)?'red':'black'}. `+(net>0?`You win ${money(net)}!`:net===0?'You break even.':`You lose ${money(-net)}.`);
  $('rMsg').textContent=ro.msg;
  setTimeout(()=>{cell.classList.remove('hit');ro.bets={};ro.spinning=false;ro.sw=0;renderRoul()},1300)}
// chip stacks for the current bets: inside bets on their anchor, outside bets on their button
function roChips(){const ov=$('rOvl');ov.replaceChildren();
  for(const k in ro.ob)ro.ob[k].querySelectorAll('.stk').forEach(s=>s.remove());
  for(let n=0;n<=36;n++)RO_CELL[n].classList.toggle('on',!!ro.bets[cellK(n)]);
  for(const k in ro.bets){const st=chipStack(ro.bets[k]);st.dataset.k=k;
    if(RO_ANC[k]){const[a,b]=RO_ANC[k];st.style.left=`calc(${a/13*100}% - 13px)`;st.style.top=`calc(${b/3*100}% - 13px)`;ov.appendChild(st)}
    else{st.classList.add('ob');ro.ob[k].appendChild(st)}}
  for(const k of RO_OUT)ro.ob[k].classList.toggle('on',!!ro.bets[k])}
const cellK=n=>n===0?'n0':'n'+n;
function renderRoul(){
  const tot=roTotal();
  $('rMsg').textContent=ro.msg;
  if(!ro.sw){$('rCash').textContent=`Cash ${money(me.cash)}  Limit ${money(RO_MAX*tableK)}`;roChips()}
  const H=$('rHist');H.replaceChildren();
  for(const n of ro.hist.slice(0,15)){const e=document.createElement('span');e.className='rh '+(n===0?'g':REDS.has(n)?'r':'k');e.textContent=n;H.appendChild(e)}
  const cnt=Array(37).fill(0);for(const n of ro.hist)cnt[n]++;
  const ord=[...Array(37).keys()].sort((a,b)=>cnt[b]-cnt[a]||a-b);
  $('rHot').textContent=ro.hist.length<10?'Hot and cold numbers show after 10 spins.':`Hot ${ord.slice(0,5).join(' · ')}   Cold ${ord.slice(-5).reverse().join(' · ')}`;
  const C=$('rChips');C.replaceChildren();
  for(const v of RO_CHIPS){const b=document.createElement('button');b.type='button';b.className=`cb c${v}${ro.chip===v?' on':''}`;b.textContent=v>=1000?'1K':'$'+v;b.onclick=()=>{ro.chip=v;renderRoul()};C.appendChild(b)}
  const A=$('rAct');A.replaceChildren();
  mkBtn(A,ro.spinning?'Spinning...':`Spin $${tot}`,roSpin,'go',ro.spinning||ro.sw||!tot);
  mkBtn(A,'Repeat last bet',roRebet,'',ro.spinning||ro.sw||!ro.lastBets);
  mkBtn(A,'Double',roDouble,'',ro.spinning||ro.sw||!tot);
  mkBtn(A,'Clear bets',roClear,'',ro.spinning||ro.sw||!tot)}
// rouletteRTP(n): random legal bets (1 to 4 spots, random chip each), returns money back / money staked
function roRandBets(){const b={},k=1+Math.floor(rand()*4);for(let j=0;j<k;j++){const key=RO_KEYS[Math.floor(rand()*RO_KEYS.length)];b[key]=(b[key]||0)+RO_CHIPS[Math.floor(rand()*RO_CHIPS.length)]}return b}
function rouletteRTP(n){let st=0,bk=0;for(let i=0;i<n;i++){const b=roRandBets();for(const k in b)st+=b[k];bk+=roPay(b,Math.floor(rand()*37))}return bk/st}
roDraw();renderRoul();
if(DBG)Object.defineProperties(DBG,{bjSim:{get:()=>bjSim},rouletteRTP:{get:()=>rouletteRTP},openBJ:{get:()=>openBJ}});
if(DBG)Object.defineProperties(DBG,{ro:{get:()=>ro}});

// ---------- Candy Cascade slots ----------
// Rules: 8 or more of one candy pays and tumbles away. 4 or more lollipops start 10 free spins, 3 or more in free spins add 5.
// candyRun() plays one view and returns every step. The animation replays those steps and slotRTP() counts the same results.
const CANDY=[{k:'banana',w:22,p:[.075,.18,.45],c:'#ffd83d'},{k:'grape',w:20,p:[.12,.24,.75],c:'#9b4dff'},{k:'melon',w:17,p:[.15,.3,1.2],c:'#ff4f6e'},{k:'apple',w:14,p:[.225,.45,1.8],c:'#ff3b3b'},{k:'sweet',w:11,p:[.375,.75,3],c:'#ff8fd6'},{k:'gem',w:8,p:[.75,1.8,6],c:'#49d8ff'},{k:'heart',w:5,p:[1.5,3.75,9],c:'#ff2d70'}];
const SCAT=7,BOMB=8,BOMBM=[2,2,3,3,4,5,6,6,7,8,12],SCATPAY=[3,5,20],SL_TRIG=4,SL_FREE=10,SL_RETRIG=3,SL_ADD=5;
const sl={el:$('slots'),bet:10,grid:[],feat:false,free:0,ftot:0,busy:false,msg:'Pick a bet and spin.',wv:0,shown:0,base:0,mult:0,flash:0,pt:[],coins:[],fly:[],sh:0,big:null,ban:null,click:null,skip:false,wq:[]};
const slCol=s=>s<7?CANDY[s].c:s===SCAT?'#ff8fd6':'#ffd23a';
function slSym(fs){const r=rand();if(r<.032)return{s:SCAT};if(fs&&r<.064)return{s:BOMB,m:BOMBM[(rand()*11)|0]};let t=rand()*97;for(let i=0;i<7;i++){t-=CANDY[i].w;if(t<=0)return{s:i}}return{s:0}}
// 8 or more of one candy anywhere pays. Pay is in bet multiples.
function candyHits(g){const by=[[],[],[],[],[],[],[]];for(const col of g)for(const c of col)if(c.s<7)by[c.s].push(c);
  const cells=[];let pay=0;for(let i=0;i<7;i++){const n=by[i].length;if(n>=8){pay+=CANDY[i].p[n>=12?2:n>=10?1:0];cells.push(...by[i])}}return{cells,pay}}
// One view. buy: put 4 lollipops on the first view (feature buy). Bombs multiply the cluster wins of the view they land in.
function candyRun(fs,buy){
  const g=[];for(let x=0;x<6;x++){const c=[];for(let y=0;y<5;y++)c.push(slSym(fs));g.push(c)}
  if(buy)for(let k=0;k<4;){const x=(rand()*6)|0,y=(rand()*5)|0;if(g[x][y].s!==SCAT){g[x][y]={s:SCAT};k++}}
  const init=g.map(c=>c.slice()),scat=init.flat().filter(c=>c.s===SCAT).length,steps=[];let base=0;
  for(let guard=0;guard<25;guard++){const h=candyHits(g);if(!h.cells.length)break;
    const hit=new Set(h.cells);
    for(let x=0;x<6;x++){const keep=g[x].filter(c=>!hit.has(c));while(keep.length<5)keep.unshift(slSym(fs));g[x]=keep}
    steps.push({hit:h.cells,pay:h.pay,after:g.map(c=>c.slice())});base+=h.pay}
  const bombs=g.flat().filter(c=>c.s===BOMB),mul=bombs.reduce((a,c)=>a+c.m,0),sp=scat>=SL_TRIG?SCATPAY[Math.min(scat,6)-SL_TRIG]:0;
  return{init,steps,bombs,base,mul:bombs.length?mul:1,sp,scat,total:base*(bombs.length?mul:1)+sp}}
// Free spins for a feature that starts now (buy: first view has the forced lollipops). Same rules as slView().
// Free-spin retrigger rule, shared by slFeat (sim) and slSpin (live). A view adds SL_ADD spins when it lands SL_RETRIG or more lollipops. A bought feature's first view never adds.
const slAdd=(r,first)=>!first&&r.scat>=SL_RETRIG?SL_ADD:0;
function slFeat(buy){let w=0,f=SL_FREE,first=buy;while(f>0){const q=candyRun(true,first);w+=q.total;f+=slAdd(q,first);first=false;f--}return w}
// Plays n spins with the same math and no animation, on a fixed seed so the numbers repeat. 'candy' is a base spin, 'candyBuy' is one feature bought (cost 45 bets), 'neon7' is one spin.
function slotRTP(m,n){
  if(!['candy','candyBuy','neon7'].includes(m))throw new Error('slotRTP: unknown machine '+m);
  let won=0,hit=0,feat=0;const keep=rand;rand=seeded(12345);
  try{for(let i=0;i<n;i++){let w;
    if(m==='neon7')w=n7Eval(n7Spin().a);
    else if(m==='candy'){const r=candyRun(false,false);w=r.total;if(r.scat>=SL_TRIG){feat++;w+=slFeat(false)}}
    else w=slFeat(true);
    won+=w;if(w>0)hit++}}
  finally{rand=keep}
  const cost=m==='candyBuy'?45:1;return{rtp:+(won/(n*cost)).toFixed(4),hitRate:+(hit/n).toFixed(4),featureRate:+(feat/n).toFixed(5)}}

// Timing. reduced motion shortens every wait and tween to a quick fade.
const slT=ms=>reduced?Math.min(ms,80):ms;
const T0=()=>AC?AC.currentTime:0;
const slWait=(m,ms)=>new Promise(r=>{if(m.skip)return r();m.wq.push([performance.now()+ms,r])});
// Closing the modal ends every wait and prompt at once, so the rest of the feature plays out and pays.
function slFlush(m){m.skip=true;const q=m.wq;m.wq=[];q.forEach(w=>w[1]());if(m.click){const f=m.click;m.click=null;f()}}
function slAsk(m,t,s,b){if(m.skip)return Promise.resolve();const o=$('slOv');o.querySelector('.t').textContent=t;o.querySelector('.s').textContent=s;o.querySelector('button').textContent=b;o.hidden=false;return new Promise(r=>{m.click=()=>{o.hidden=true;r()}})}
$('slOv').querySelector('button').onclick=()=>{const f=sl.click;sl.click=null;f&&f()};
let slRaf=0,slLast=0;
function slStart(){if(!slRaf)slRaf=requestAnimationFrame(slLoop)}
// One loop for both machines. It runs only while a slot modal is open.
function slLoop(now){slRaf=0;const dt=slLast?Math.min(.05,(now-slLast)/1000):0;slLast=now;let any=false;
  for(const m of [sl,s7]){if(m.el.hidden){if(!m.skip)slFlush(m);continue}any=true;m.skip=false;m.wq=m.wq.filter(w=>{if(w[0]>now)return true;w[1]();return false})}
  if(!sl.el.hidden)slDraw(sl,now,dt);
  if(!s7.el.hidden)s7Draw(now,dt);
  if(any)slRaf=requestAnimationFrame(slLoop);else slLast=0}
// Canvas sized to its CSS box. Drawing happens in 640-wide logical units.
function slFit(cv,W,H){const s=(cv.clientWidth||W)*(devicePixelRatio||1)/W,pw=Math.round(W*s),ph=Math.round(H*s);
  if(cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph}const g=cv.getContext('2d');g.setTransform(pw/W,0,0,pw/W,0,0);return g}
const slCellXY=(x,y)=>[29+x*98+46,104+y*64+30];
const slBounce=p=>{const n=7.5625,d=2.75;return p<1/d?n*p*p:p<2/d?n*(p-=1.5/d)*p+.75:p<2.5/d?n*(p-=2.25/d)*p+.9375:n*(p-=2.625/d)*p+.984375};
// Row position of a cell at time now. Cells move from fr to tr with cubic-out (e 0), bounce (e 1) or cubic-in (e 2).
function slPos(c,now){if(c.t0===undefined)return c.tr;const p=Math.min(1,Math.max(0,(now-c.t0)/c.dur)),e=c.e===2?p*p*p:c.e===1?slBounce(p):1-Math.pow(1-p,3);return c.fr+(c.tr-c.fr)*e}
function slPosOf(m,c){const t=performance.now();for(let x=0;x<6;x++){const y=m.grid[x].indexOf(c);if(y>=0)return slCellXY(x,slPos(c,t))}return[320,250]}
// Old cells drop out of the bottom, column by column. Returns ms until the last one is gone.
function slDropOut(m){const now=performance.now();let end=now;m.grid.forEach((col,x)=>col.forEach(c=>{c.fr=c.tr;c.tr=6;c.t0=now+x*slT(60);c.dur=slT(220);c.e=2;c.h=0;c.ant=0;end=Math.max(end,c.t0+c.dur)}));return end-now}
// Tweens grid G into place. Kept cells slide from their old row. New cells fall from above. ant: after 3 lollipops land, the rest slow down and glow.
function slFall(m,G,ant){const now=performance.now(),kept=new Set(m.grid.flat());let sc=0,t=0,hot=false,end=now;
  for(let x=0;x<6;x++){const col=G[x],k=col.filter(c=>!kept.has(c)).length,slow=ant&&sc>=3,dur=slT(slow?900:380);
    if(slow&&!hot){hot=true;tone('sawtooth',160,1.2,.06,T0()+t/1000,null,820)}
    col.forEach((c,y)=>{const old=kept.has(c);c.fr=old?c.tr:y-k;c.tr=y;c.t0=now+t;c.dur=dur;c.e=old?0:1;c.ant=slow?1:0});
    tone('square',1300+x*110,.05,.05,T0()+(t+dur)/1000);
    sc+=col.filter(c=>c.s===SCAT).length;
    end=Math.max(end,now+t+dur);t+=slow?300:70}
  m.grid=G;return end-now}
function slBurst(m,x,y,col,n){for(let i=0;i<n;i++){const a=rand()*TAU,s=rr(140,460);m.pt.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-180,l:0,max:slT(rr(450,900))/1000,c:col})}}
// Symbol art: vector shapes drawn once per size into offscreen canvases. Units are about -1.3 to 1.3 around the centre.
const SPR={};
function slSpr(k,S){S=Math.round(S/8)*8;const key=k+'|'+S;if(SPR[key])return SPR[key];const c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');g.setTransform(S/2.6,0,0,S/2.6,S/2,S/2);ART[k](g);return SPR[key]=c}
function slBody(g,path,stops,y0,y1){const S=g.canvas.width;g.save();g.shadowColor='rgba(40,0,30,.5)';g.shadowBlur=S*.05;g.shadowOffsetY=S*.035;path(g);const f=g.createLinearGradient(0,y0,0,y1);stops.forEach((c,i)=>f.addColorStop(i/(stops.length-1),c));g.fillStyle=f;g.fill();g.restore();
  g.save();path(g);g.clip();const h=g.createRadialGradient(-.3,-.42,0,-.3,-.42,.95);h.addColorStop(0,'rgba(255,255,255,.9)');h.addColorStop(.45,'rgba(255,255,255,.15)');h.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=h;g.fillRect(-1.5,-1.5,3,3);g.restore();
  path(g);g.lineWidth=.07;g.strokeStyle='rgba(255,255,255,.85)';g.stroke()}
const ART={
0:g=>{slBody(g,c=>{c.beginPath();c.moveTo(-.85,-.4);c.quadraticCurveTo(0,1.05,.85,-.55);c.quadraticCurveTo(.05,.45,-.85,-.4);c.closePath()},['#fffbd0','#ffd83d','#c98a00'],-.4,1);
  g.fillStyle='#5b3b00';for(const[x,y]of[[-.85,-.4],[.85,-.55]]){g.beginPath();g.arc(x,y,.09,0,TAU);g.fill()}},
1:g=>{const pts=[[0,-.6],[-.27,-.28],[.27,-.28],[-.54,.02],[0,.02],[.54,.02],[-.27,.32],[.27,.32]];
  g.strokeStyle='#5ac44a';g.lineWidth=.08;g.beginPath();g.moveTo(0,-.78);g.lineTo(.08,-1.05);g.stroke();
  g.fillStyle='#4fd36b';g.beginPath();g.ellipse(.36,-.92,.26,.12,-.5,0,TAU);g.fill();
  for(const[x,y]of pts){const f=g.createRadialGradient(x-.08,y-.09,.02,x,y,.26);f.addColorStop(0,'#eedcff');f.addColorStop(.35,'#9b4dff');f.addColorStop(1,'#2a0a5e');g.save();g.shadowColor='rgba(40,0,30,.5)';g.shadowBlur=g.canvas.width*.03;g.fillStyle=f;g.beginPath();g.arc(x,y,.24,0,TAU);g.fill();g.restore();
    g.fillStyle='rgba(255,255,255,.9)';g.beginPath();g.arc(x-.08,y-.09,.05,0,TAU);g.fill()}},
2:g=>{slBody(g,c=>{c.beginPath();c.arc(0,-.2,.95,0,Math.PI);c.closePath()},['#86f08a','#1f9d46','#0b5a2a'],-.2,.8);
  g.beginPath();g.arc(0,-.2,.8,0,Math.PI);g.closePath();const f=g.createLinearGradient(0,-.2,0,.6);f.addColorStop(0,'#ffd0d8');f.addColorStop(.25,'#ff5f7a');f.addColorStop(1,'#d8123f');g.fillStyle=f;g.fill();
  g.fillStyle='#2b0a12';for(const[x,y]of[[-.42,.12],[0,.2],[.42,.12],[-.22,.4],[.22,.4],[0,.56]]){g.beginPath();g.ellipse(x,y,.045,.085,0,0,TAU);g.fill()}},
3:g=>{const ap=c=>{c.beginPath();c.moveTo(0,-.42);c.bezierCurveTo(.22,-.68,.8,-.66,.8,.02);c.bezierCurveTo(.8,.62,.38,.92,0,.74);c.bezierCurveTo(-.38,.92,-.8,.62,-.8,.02);c.bezierCurveTo(-.8,-.66,-.22,-.68,0,-.42);c.closePath()};
  g.strokeStyle='#6b4423';g.lineWidth=.09;g.beginPath();g.moveTo(0,-.42);g.quadraticCurveTo(.02,-.7,.14,-.86);g.stroke();
  slBody(g,ap,['#ff9a9a','#e3132d','#7d0016'],-.7,.9);
  g.fillStyle='#4fd36b';g.beginPath();g.ellipse(.3,-.72,.26,.12,-.45,0,TAU);g.fill()},
4:g=>{const wr=s=>c=>{c.beginPath();c.moveTo(s*.4,-.14);c.lineTo(s*.98,-.46);c.lineTo(s*.98,.46);c.lineTo(s*.4,.14);c.closePath()};
  slBody(g,wr(-1),['#c9f8ff','#3bc8e8','#1b6fa0'],-.5,.5);slBody(g,wr(1),['#c9f8ff','#3bc8e8','#1b6fa0'],-.5,.5);
  slBody(g,c=>{c.beginPath();c.arc(0,0,.46,0,TAU)},['#fff3a6','#ff8fd6','#c4137a'],-.46,.46);
  g.strokeStyle='rgba(255,255,255,.8)';g.lineWidth=.07;g.beginPath();g.arc(0,0,.25,.4,4.4);g.stroke()},
5:g=>{const gm=c=>{c.beginPath();c.moveTo(-.75,-.25);c.lineTo(-.42,-.7);c.lineTo(.42,-.7);c.lineTo(.75,-.25);c.lineTo(0,.8);c.closePath()};
  slBody(g,gm,['#f2feff','#49d8ff','#1d5cff'],-.7,.8);
  g.strokeStyle='rgba(255,255,255,.6)';g.lineWidth=.035;g.beginPath();g.moveTo(-.75,-.25);g.lineTo(.75,-.25);g.moveTo(-.42,-.7);g.lineTo(-.2,-.25);g.moveTo(.42,-.7);g.lineTo(.2,-.25);g.moveTo(-.2,-.25);g.lineTo(0,.8);g.moveTo(.2,-.25);g.lineTo(0,.8);g.stroke();
  g.fillStyle='#fff';g.beginPath();g.arc(.5,-.5,.07,0,TAU);g.fill()},
6:g=>{slBody(g,c=>{c.beginPath();c.moveTo(0,.8);c.bezierCurveTo(-1.1,.05,-.72,-.92,0,-.36);c.bezierCurveTo(.72,-.92,1.1,.05,0,.8);c.closePath()},['#ffc2d6','#ff2d70','#8c0030'],-.9,.8)},
7:g=>{g.fillStyle='#f4eeff';g.fillRect(-.07,.5,.14,.8);
  slBody(g,c=>{c.beginPath();c.arc(0,-.05,.72,0,TAU)},['#ffffff','#ff7ad9','#b0107a'],-.8,.7);
  const cols=['#ffe14d','#3ee6ff','#ff4fa8','#8cff6a'];g.lineCap='round';g.lineWidth=.1;
  for(let i=0;i<40;i++){const a=i*.45,a2=(i+1)*.45,r=.05+i*.0135,r2=.05+(i+1)*.0135;g.strokeStyle=cols[i%4];g.beginPath();g.moveTo(Math.cos(a)*r,-.05+Math.sin(a)*r);g.lineTo(Math.cos(a2)*r2,-.05+Math.sin(a2)*r2);g.stroke()}},
8:g=>{g.strokeStyle='#c9a36b';g.lineWidth=.08;g.beginPath();g.moveTo(.3,-.5);g.quadraticCurveTo(.5,-.9,.78,-.92);g.stroke();
  slBody(g,c=>{c.beginPath();c.arc(-.05,.1,.66,0,TAU)},['#8a8aa0','#24242f','#050508'],-.5,.8);
  g.save();g.shadowColor='#ffb020';g.shadowBlur=g.canvas.width*.08;g.fillStyle='#ffd23a';g.beginPath();g.arc(.78,-.92,.13,0,TAU);g.fill();g.restore()},
n0:g=>{g.strokeStyle='#3dd68c';g.lineWidth=.09;g.beginPath();g.moveTo(-.42,.36);g.quadraticCurveTo(-.2,-.25,.18,-.78);g.moveTo(.42,.18);g.quadraticCurveTo(.25,-.2,.18,-.78);g.stroke();
  g.fillStyle='#3dd68c';g.beginPath();g.ellipse(.55,-.66,.32,.14,-.5,0,TAU);g.fill();
  slBody(g,c=>{c.beginPath();c.arc(-.42,.45,.36,0,TAU)},['#ffb3bf','#ff1f4b','#7a0019'],.1,.81);
  slBody(g,c=>{c.beginPath();c.arc(.42,.27,.36,0,TAU)},['#ffb3bf','#ff1f4b','#7a0019'],0,.72)},
n1:g=>{g.fillStyle='#3dd68c';g.beginPath();g.ellipse(.58,-.55,.3,.13,-.6,0,TAU);g.fill();
  slBody(g,c=>{c.beginPath();c.ellipse(0,0,.9,.66,0,0,TAU)},['#fffbc2','#ffe02e','#c99a00'],-.66,.66)},
n2:g=>{slBody(g,c=>{c.beginPath();c.roundRect(-.95,-.5,1.9,1,.18)},['#3a2f58','#16101f','#07050c'],-.5,.5);
  g.fillStyle='#ffd84a';g.font='900 .5px "Arial Black",Impact,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('BAR',0,.04)},
n3:g=>{for(const y of[-.52,.12]){slBody(g,c=>{c.beginPath();c.roundRect(-.95,y,1.9,.4,.1)},['#3a2f58','#16101f'],y,y+.4);
    g.fillStyle='#ffd84a';g.font='900 .3px "Arial Black",Impact,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('BAR',0,y+.2)}},
n4:g=>{slBody(g,c=>{c.beginPath();c.moveTo(-.78,.42);c.bezierCurveTo(-.8,-.1,-.62,-.78,0,-.78);c.bezierCurveTo(.62,-.78,.8,-.1,.78,.42);c.lineTo(.98,.6);c.lineTo(-.98,.6);c.closePath()},['#fff5b0','#ffc83a','#9a6200'],-.78,.6);
  slBody(g,c=>{c.beginPath();c.arc(0,.78,.17,0,TAU)},['#fff5b0','#ffb020'],.6,.95)},
n5:g=>{g.font='900 2.5px "Arial Black",Impact,sans-serif';g.textAlign='center';g.textBaseline='middle';g.shadowColor='rgba(255,46,77,.9)';g.shadowBlur=g.canvas.width*.05;g.lineWidth=.16;g.strokeStyle='#fff';g.strokeText('7',0,.1);g.fillStyle='#ff2e4d';g.fillText('7',0,.1)},
n6:g=>{g.font='900 2.5px "Arial Black",Impact,sans-serif';g.textAlign='center';g.textBaseline='middle';g.shadowColor='#ff3ea5';g.shadowBlur=g.canvas.width*.14;g.fillStyle='#ff4fd8';g.fillText('7',0,.1);g.shadowBlur=0;g.lineWidth=.06;g.strokeStyle='#fff';g.strokeText('7',0,.1)}};
function slDraw(m,now,dt){
  const g=slFit($('slc'),640,440),k=g.canvas.width/640,S=Math.round(74*k),FF='Bungee,Impact,sans-serif',BF='"Chakra Petch",system-ui,sans-serif';
  m.sh*=Math.exp(-dt*6);m.shown+=(m.wv-m.shown)*Math.min(1,dt*9);
  const jx=m.sh>.01?(rand()-.5)*m.sh*14:0,jy=m.sh>.01?(rand()-.5)*m.sh*14:0;
  g.save();g.translate(jx,jy);
  const bg=g.createLinearGradient(0,0,0,440);bg.addColorStop(0,'#3a0f52');bg.addColorStop(1,'#0c0426');g.fillStyle=bg;g.fillRect(-20,-20,680,480);
  const rg=g.createRadialGradient(320,30,10,320,30,380);rg.addColorStop(0,'rgba(255,62,165,.4)');rg.addColorStop(1,'rgba(255,62,165,0)');g.fillStyle=rg;g.fillRect(-20,-20,680,480);
  g.beginPath();g.roundRect(24,96,592,330,14);g.fillStyle='rgba(8,4,24,.6)';g.fill();g.lineWidth=2;g.strokeStyle='rgba(255,143,200,.7)';g.stroke();
  g.save();g.beginPath();g.roundRect(24,96,592,330,14);g.clip();
  m.grid.forEach((col,x)=>col.forEach(c=>{if(c.dead)return;const[cx,cy]=slCellXY(x,slPos(c,now)),age=c.h?(now-c.h)/400:9,hot=age<1;
    if(hot){g.globalAlpha=1-age*.5;g.drawImage(glow(slCol(c.s)),cx-58,cy-58,116,116)}
    if(c.ant){g.globalAlpha=.45+.35*Math.sin(now/110);g.drawImage(glow('#ff3ea5'),cx-62,cy-62,124,124)}
    g.globalAlpha=1;const sc=hot?1+.14*Math.sin(Math.PI*age):1;
    g.save();g.translate(cx,cy);g.scale(sc,sc);if(c.s===BOMB)g.drawImage(glow('#ff9a2e'),-44,-44,88,88);g.drawImage(slSpr(c.s,S),-37,-37,74,74);
    if(c.s===BOMB){g.fillStyle='#fff';g.font='900 15px '+FF;g.textAlign='center';g.textBaseline='middle';g.fillText('x'+c.m,0,2)}
    g.restore()}));
  g.restore();
  // flying bombs go to the multiplier pill on a quadratic curve
  m.fly=m.fly.filter(f=>now-f.t0<f.dur);
  for(const f of m.fly){const q=(now-f.t0)/f.dur,e=q*q*(3-2*q),mx=(f.x0+f.x1)/2,my=Math.min(f.y0,f.y1)-130;
    const x=(1-e)*(1-e)*f.x0+2*(1-e)*e*mx+e*e*f.x1,y=(1-e)*(1-e)*f.y0+2*(1-e)*e*my+e*e*f.y1;
    g.save();g.translate(x,y);g.scale(.6,.6);g.drawImage(slSpr(BOMB,S),-37,-37,74,74);g.restore()}
  // particles: sparks in the symbol colour
  for(const p of m.pt){p.l+=dt;p.vy+=900*dt;p.x+=p.vx*dt;p.y+=p.vy*dt}
  m.pt=m.pt.filter(p=>p.l<p.max);
  g.save();g.globalCompositeOperation='lighter';g.lineCap='round';
  for(const p of m.pt){const a=1-p.l/p.max;g.globalAlpha=a;g.strokeStyle=p.c;g.lineWidth=3*a+1;g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x-p.vx*.04,p.y-p.vy*.04);g.stroke()}
  g.restore();g.globalAlpha=1;
  // HUD: bet and feature left, win counter centre, multiplier pill right
  g.textAlign='left';g.textBaseline='alphabetic';g.fillStyle='#f3ecff';g.font='700 15px '+BF;g.fillText('BET $'+m.bet.toLocaleString('en-US'),34,38);
  if(m.feat){g.fillStyle='#ff8fc8';g.font='700 15px '+BF;g.fillText('FREE SPINS '+Math.max(0,m.free),34,62);g.fillStyle='#ffd1ea';g.font='600 13px '+BF;g.fillText('Feature $'+m.ftot.toLocaleString('en-US'),34,82)}
  const fl=m.flash?Math.max(0,1-(now-m.flash)/450):0;
  g.textAlign='center';g.fillStyle='#c7b8e6';g.font='700 12px '+BF;g.fillText('WIN',320,24);
  g.save();g.shadowColor=fl>0?'#fff3a6':'#ff3ea5';g.shadowBlur=16+24*fl;g.fillStyle='#ffe066';g.font='40px '+FF;g.fillText('$'+Math.round(m.shown).toLocaleString('en-US'),320,70);g.restore();
  g.save();g.translate(566,52);g.scale(1+.22*fl,1+.22*fl);g.beginPath();g.roundRect(-56,-22,112,44,22);g.fillStyle=fl>0?'#fff3a6':'#ffd84a';g.fill();g.fillStyle='#2a0530';g.font='24px '+FF;g.textBaseline='middle';g.fillText('x'+(m.mult||1),0,2);g.restore();
  // big win: veil, tier word counting up, coins
  if(m.big){const B=m.big,a=Math.min(1,(now-B.t0)/160),s0=Math.min(1,(now-B.t0)/420),sc=1+2.70158*Math.pow(s0-1,3)+1.70158*Math.pow(s0-1,2);
    g.save();g.beginPath();g.roundRect(24,96,592,330,14);g.clip();
    g.fillStyle=`rgba(6,2,16,${.74*a})`;g.fillRect(24,96,592,330);
    for(const c of m.coins){c.vy+=760*dt;c.y+=c.vy*dt;c.a+=c.w*dt;if(c.y>440){c.y=-20;c.vy=rr(60,160)}g.save();g.translate(c.x,c.y);g.scale(Math.abs(Math.cos(c.a))*.85+.15,1);g.beginPath();g.arc(0,0,9,0,TAU);g.fillStyle='#ffd23a';g.fill();g.lineWidth=2;g.strokeStyle='#9a6200';g.stroke();g.restore()}
    g.save();g.translate(320,196);g.scale(Math.max(.01,sc),Math.max(.01,sc));g.textBaseline='middle';g.font='58px '+FF;g.lineWidth=10;g.lineJoin='round';g.strokeStyle='#2a0530';g.strokeText(B.tier,0,0);g.shadowColor=B.col;g.shadowBlur=26;g.fillStyle=B.col;g.fillText(B.tier,0,0);g.restore();
    g.save();g.textAlign='center';g.textBaseline='middle';g.font='44px '+FF;g.shadowColor='#ff3ea5';g.shadowBlur=18;g.fillStyle='#fff';g.fillText('$'+Math.round(B.amt*Math.min(1,(now-B.t0)/2400)).toLocaleString('en-US'),320,262);g.restore();
    g.restore()}
  // retrigger banner
  if(m.ban){const q=(now-m.ban.t0)/m.ban.dur;if(q<1){g.save();g.globalAlpha=Math.min(1,q*5,(1-q)*3);g.textAlign='center';g.textBaseline='middle';g.font='34px '+FF;g.shadowColor='#7bf7ff';g.shadowBlur=20;g.fillStyle='#7bf7ff';g.fillText(m.ban.text,320,160);g.restore()}}
  g.restore()}
// One view: old grid out, new grid in, cascades, bombs, pay. Returns the view result.
async function slView(m,buy){
  const r=candyRun(m.feat,buy),b=m.bet;
  m.msg=m.feat?'Free spin!':'Spinning...';renderSlots();
  if(m.grid.length){const end=slDropOut(m);await slWait(m,end);m.grid=[]}
  m.wv=0;m.base=0;m.mult=0;
  await slWait(m,slFall(m,r.init,true));
  for(const st of r.steps){
    const t=performance.now();st.hit.forEach(c=>{c.h=t});
    tone('triangle',mf(79),.3,.07,T0());tone('triangle',mf(83),.3,.06,T0()+.06);
    await slWait(m,slT(420));
    for(const c of st.hit){const[x,y]=slPosOf(m,c);slBurst(m,x,y,slCol(c.s),reduced?4:16);c.dead=1}
    m.base+=st.pay*b;m.wv=m.base*(m.mult||1);
    await slWait(m,slFall(m,st.after,false)+40)}
  if(r.base>0)for(const c of r.bombs){const[x0,y0]=slPosOf(m,c);m.fly.push({x0,y0,x1:320,y1:52,t0:performance.now(),dur:slT(380)});
    await slWait(m,slT(380));
    c.dead=1;m.mult+=c.m;m.flash=performance.now();m.wv=m.base*m.mult;tone('square',mf(72+(c.m>9?12:0)),.12,.08,T0());
    await slWait(m,slT(80))}
  if(r.sp){const t=performance.now();m.grid.flat().forEach(c=>{if(c.s===SCAT)c.h=t});await slWait(m,slT(480))}
  const pay=Math.round(r.total*b);me.cash+=pay;if(m.feat)m.ftot+=pay;m.wv=pay;
  m.msg=(pay?'Win $'+pay.toLocaleString('en-US')+'!':'No win.')+(m.feat?' Free spins: '+m.free:'');renderSlots();saveArsenal();
  if(r.total>=20){const tier=r.total>=100?'EPIC WIN':r.total>=50?'MEGA WIN':'BIG WIN',col=r.total>=100?'#7bf7ff':r.total>=50?'#ff8fc8':'#ffd84a';
    m.big={t0:performance.now(),amt:pay,tier,col};m.coins=Array.from({length:40},()=>({x:rr(40,600),y:rr(-460,-10),vy:rr(80,200),a:rand()*6,w:rr(3,9)}));m.sh=reduced?0:.8;
    if(pay>=b*50)feed(`Big slots win: +$${pay.toLocaleString('en-US')}`);
    jingle('pass');await slWait(m,slT(3000));m.big=null;m.coins=[]}
  return r}
// A spin press: base spin, feature buy, or the automatic free spins that follow a trigger.
async function slSpin(buy){
  const m=sl;if(m.busy)return;
  if(buy){if(me.cash<m.bet*45){m.msg='Not enough cash for the feature.';renderSlots();return}me.cash-=m.bet*45;saveArsenal();m.feat=true;m.free=SL_FREE;m.ftot=0}
  else if(!m.feat){if(me.cash<m.bet){m.msg='Not enough cash.';renderSlots();return}me.cash-=m.bet;saveArsenal()}
  m.busy=true;renderSlots();
  for(let first=buy;;first=false){
    if(m.feat)m.free--;
    const r=await slView(m,first);
    if(!m.feat){if(r.scat<SL_TRIG)break;m.feat=true;m.free=SL_FREE;m.ftot=0;await slAsk(m,'FREE SPINS: '+SL_FREE,r.scat+' lollipops landed. The free spins play out on their own.','Start');continue}
    const add=slAdd(r,first);if(add){m.free+=add;m.ban={t0:performance.now(),text:'+'+add+' FREE SPINS',dur:slT(1600)};await slWait(m,slT(1600))}
    if(m.free<=0){m.feat=false;m.msg='Feature paid $'+m.ftot.toLocaleString('en-US')+'.';renderSlots();await slAsk(m,'FEATURE OVER','Free spins won $'+m.ftot.toLocaleString('en-US'),'Collect');break}
    await slWait(m,slT(400))}
  m.busy=false;renderSlots()}
function renderSlots(){
  const m=sl;$('sMsg').textContent=`${m.msg}  Cash $${me.cash.toLocaleString('en-US')}`;
  const A=$('sAct');A.replaceChildren();
  for(const v of[10,50,100,500,1000])mkBtn(A,'$'+v,()=>{if(!m.busy&&!m.feat){m.bet=v;renderSlots()}},'chip'+(m.bet===v?' on':''),m.busy||m.feat);
  mkBtn(A,m.feat?`Free spins: ${m.free} left`:`Spin $${m.bet}`,()=>slSpin(false),'go',m.busy||(!m.feat&&me.cash<m.bet));
  mkBtn(A,`Buy feature $${(m.bet*45).toLocaleString('en-US')}`,()=>slSpin(true),'',m.busy||m.feat||me.cash<m.bet*45)}
function casinoOpenSlots(){sl.skip=false;if(!sl.grid.length)slFall(sl,Array.from({length:6},()=>Array.from({length:5},()=>slSym(false))),false);renderSlots();slStart();$('sAct').querySelector('.go')?.focus()}
// Space or Enter spins the open machine. The busy guard stops double spins. Escape still closes through closeShop().
addEventListener('keydown',e=>{if(e.repeat||(e.code!=='Space'&&e.code!=='Enter'))return;
  if(!sl.el.hidden){e.preventDefault();slSpin(false)}else if(!s7.el.hidden){e.preventDefault();s7Spin()}});
if(DBG)Object.defineProperties(DBG,{slotRTP:{get:()=>slotRTP},sl:{get:()=>sl},s7:{get:()=>s7},casino:{get:()=>casino},interact:{get:()=>interact}});

// ---------- casino games ----------
// High-limit room in the VIP area. Players need $100,000 in cash (or VIP, once a later ticket adds it).
const HL_MIN=100000;
function hlGate(){if(me.cash>=HL_MIN||me.vip)return true;feed(`High-limit tables need ${fmtCash(HL_MIN)} in cash`);return false}
const fmtCash=n=>'$'+Math.round(n).toLocaleString('en-US');
// Lucky Wheel. Each segment is [label, kind, value, weight]; weights sum to 100. The jackpot has weight 1.
const LW=[['$500','c',500,14],['RP 100','r',100,11],['$1,000','c',1000,11],['Chips $2,000','h',2000,7],['$500','c',500,14],['RP 250','r',250,7],['$2,500','c',2500,6],['Mystery','m',0,5],['$1,000','c',1000,8],['$5,000','c',5000,3],['RP 500','r',500,3],['Chips $5,000','h',5000,2],['$1,000','c',1000,2],['$500','c',500,1],['RP 100','r',100,1],['Mystery','m',0,1],['$2,500','c',2500,1],['Chips $2,000','h',2000,1],['$50,000','c',50000,1],['JACKPOT $250,000','j',250000,1]];
const LWC={c:'#1f7a48',r:'#2b6fd6',h:'#c2306e',m:'#6a3bb8',j:'#ffc94a'};
const lwDay=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
let lwLast='';
// Reads the saved spin day again, so a spin made in another tab counts here too.
function lwRead(){try{const v=localStorage.getItem('pr3d-wheel');lwLast=typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:''}catch(e){}}
lwRead();
// Picks a segment index by weight. Pure: no payout here.
function spinWheel(){const tot=LW.reduce((a,s)=>a+s[3],0);let r=rand()*tot;for(let i=0;i<LW.length;i++){r-=LW[i][3];if(r<0)return i}return LW.length-1}
// Average cash per spin over n seeded spins. Cash, chips and the jackpot count. RP and mystery do not.
function wheelValue(n){const keep=rand;rand=seeded(6604);let s=0;try{for(let i=0;i<n;i++){const[,k,v]=LW[spinWheel()];if(k==='c'||k==='h'||k==='j')s+=v}}finally{rand=keep}return s/n}
// RP is paid through gainXP, which only runs in play. The modal sets state to shop, so switch it for the call.
function casinoRP(n,why){const s=state;state='play';try{gainXP(n,why)}finally{state=s}}
const lwC=$('lwc'),lwG=lwC.getContext('2d'),LWR=180,LWX=210;
let lwS={a:0,from:0,to:0,t0:0,dur:0,spin:false,tick:-1,kick:0,raf:0};
function lwDraw(){const g=lwG,seg=TAU/LW.length;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,420,420);g.translate(LWX,LWX);
  g.fillStyle='#2a1038';g.beginPath();g.arc(0,0,LWR+14,0,TAU);g.fill();
  g.save();g.rotate(lwS.a);
  for(let i=0;i<LW.length;i++){const s0=i*seg-Math.PI/2,[l,k]=LW[i];g.fillStyle=LWC[k];g.beginPath();g.moveTo(0,0);g.arc(0,0,LWR,s0,s0+seg);g.closePath();g.fill();
}
  for(let i=0;i<LW.length;i++){const a=i*seg-Math.PI/2;g.fillStyle='#fff3c4';g.beginPath();g.arc(Math.cos(a)*LWR,Math.sin(a)*LWR,3.5,0,TAU);g.fill()}
  g.restore();
  // labels sit outside the spin transform, each turned to its on-screen angle, so none reads upside down
  for(let i=0;i<LW.length;i++){const m=i*seg-Math.PI/2+seg/2+lwS.a,flip=Math.cos(m)<0,[l,k]=LW[i];g.save();g.rotate(flip?m+Math.PI:m);g.fillStyle=k==='j'?'#2a0a14':'#fff';g.font='700 16px "Chakra Petch",sans-serif';g.textAlign=flip?'left':'right';g.textBaseline='middle';g.fillText(l.replace('JACKPOT $250,000','JACKPOT'),flip?-(LWR-12):LWR-12,0);g.restore()}
  g.strokeStyle='#ffc94a';g.lineWidth=6;g.beginPath();g.arc(0,0,LWR+4,0,TAU);g.stroke();
  g.fillStyle='#ffc94a';g.beginPath();g.arc(0,0,22,0,TAU);g.fill();g.fillStyle='#2a1038';g.beginPath();g.arc(0,0,8,0,TAU);g.fill();
  g.save();g.translate(0,-LWR-12);g.rotate(lwS.kick*.35);g.fillStyle='#fff';g.beginPath();g.moveTo(-14,-16);g.lineTo(14,-16);g.lineTo(0,10);g.closePath();g.fill();g.restore()}
function lwBtn(){const b=$('lwGo');const done=lwLast===lwDay();b.textContent=lwS.spin?'Spinning...':done?'Back tomorrow':'Spin (free today)';b.disabled=lwS.spin||done}
function lwMsg(t){$('lwMsg').textContent=t}
function lwLoop(){lwS.raf=0;const now=performance.now();
  if(lwS.spin){const t=Math.min(1,(now-lwS.t0)/lwS.dur);lwS.a=lwS.from+(lwS.to-lwS.from)*(1-Math.pow(1-t,4));if(t>=1)lwS.spin=false}
  const idx=Math.floor((((-lwS.a)%TAU)+TAU)%TAU/(TAU/LW.length));
  if(idx!==lwS.tick){if(lwS.tick>=0)tone('square',1500,.03,.05);lwS.tick=idx;lwS.kick=1}
  lwS.kick*=.86;lwDraw();
  if(lwS.spin||lwS.kick>.01)lwS.raf=requestAnimationFrame(lwLoop);else{lwBtn()}}
function lwSpin(){if(lwS.spin)return;lwRead();if(lwLast===lwDay()){lwMsg('You already spun today. Come back tomorrow.');lwBtn();return}
  // Pay once, before the wheel turns, and mark the day so a reload cannot spin again.
  const i=spinWheel(),[l,k,v]=LW[i];let mAm=0;lwLast=lwDay();try{localStorage.setItem('pr3d-wheel',lwLast)}catch(e){}
  if(k==='r')casinoRP(v,'Lucky Wheel');else if(k==='m'){for(const w of WEAPONS)if(owned[w.id]&&w.ammoAmt){ammo[w.id]=(ammo[w.id]||0)+w.ammoAmt;mAm++}}else me.cash+=v;
  saveArsenal();
  const seg=TAU/LW.length,base=((-(i+.5)*seg-lwS.a)%TAU+TAU)%TAU,jit=(rand()-.5)*seg*.6;
  lwS.from=lwS.a;lwS.to=lwS.a+6*TAU+base+jit;lwS.t0=performance.now();lwS.dur=5200;lwS.spin=true;lwS.tick=-1;
  lwMsg('Good luck...');lwBtn();if(!lwS.raf)lwS.raf=requestAnimationFrame(lwLoop);
  setTimeout(()=>{if(k==='j'){showBig('JACKPOT','#ffc94a','+'+fmtCash(v),3);jingle('level')}else if(k!=='m')jingle('pass');
    const won=k==='r'?`${v} RP`:k==='m'?(mAm?`ammo for ${mAm} gun${mAm>1?'s':''}`:'no ammo, since you own no gun that takes it'):fmtCash(v)+(k==='h'?' in chips':'');lwMsg(`Won ${won}`);feed(`Lucky Wheel: won ${won}`);if(k==='j')noise(.5,6000,.3)},5300)}
function openLucky(){lwRead();openModal('lwheel');lwMsg(lwLast===lwDay()?'Your free spin for today is gone. Come back tomorrow.':'One free spin every real day. Good luck.');lwBtn();lwDraw();$('lwGo').focus()}
$('lwGo').addEventListener('click',lwSpin);

// ---------- Rocket (crash game) ----------
// Launches run on a shared clock. Each 45 s slot opens with 8 s of betting, then the rocket flies.
// The host (the lowest peer id among players with the modal open, or this client alone) picks the crash point
// and publishes it as rk only once the flight starts, so nobody can bet on a known result.
// Bets and cash-outs stay local. A flight that would pass the slot end is cut off there (above about 2000x).
const RKG={slot:45000,win:8000,k:.2,amt:100,hist:[],hostId:-1,hostCp:0,soloId:-1,soloCp:0,bet:null,fly:null,last:'',open:false,raf:0,lt:0,cam:{x:8,y:2},parts:[],boomId:-1,histId:-1};
const rkS=now=>{const id=Math.floor(now/RKG.slot);return{id,start:id*RKG.slot+RKG.win}};
const rkMult=t=>Math.floor(Math.exp(RKG.k*Math.max(0,t))*100+1e-9)/100;
// Crash point = 0.96/(1-u) floored to two decimals, minimum 1.00 (4 percent house edge).
function rocketCP(){return Math.max(1,Math.floor(.96/(1-rand())*100)/100)}
// Cash out at 2x every round. Seeded so the result repeats.
function rocketRTP(n){const keep=rand;rand=seeded(4711);let won=0;try{for(let i=0;i<n;i++)if(rocketCP()>=2)won+=2}finally{rand=keep}return won/n}
// Other players' rk: null when their modal is closed, otherwise {id,start,cp}. id 0 means open with no flight yet.
function rkParse(v){if(!Array.isArray(v))return null;const id=Math.floor(num(v[0])),st=num(v[1]),cp=num(v[2]);
  if(id<=0||!(cp>=1)||cp>1e6||st!==id*RKG.slot+RKG.win)return{id:0,start:0,cp:0};return{id,start:st,cp}}
function rkAmHost(){if(!room||!myPeer)return true;for(const[p,r]of remotes)if(r.rk&&p<myPeer)return false;return true}
// The flight for a slot: a host's published flight wins, otherwise this client's own (if it is the host).
function rkFlight(id,start){
  if(RKG.soloId===id)return{id,start,cp:RKG.soloCp,mine:false};
  for(const r of remotes.values())if(r.rk&&r.rk.id===id)return{id,start:r.rk.start,cp:r.rk.cp,mine:false};
  if(!rkAmHost()){
    // Stall guard: no host flight 3 s after the start, so this client runs the round alone. Never published.
    if(Date.now()<start+3000)return null;
    RKG.soloId=id;RKG.soloCp=rocketCP();return{id,start,cp:RKG.soloCp,mine:false}}
  if(RKG.hostId!==id){RKG.hostId=id;RKG.hostCp=rocketCP()}
  return{id,start,cp:RKG.hostCp,mine:true}}
// Presence field. Only the host publishes a flight, and only once it has started.
function rkMine(){if(!RKG.open)return null;const now=Date.now(),s=rkS(now),f=rkFlight(s.id,s.start);return f&&f.mine&&now>=s.start?[s.id,s.start,f.cp]:[0,0,0]}
// Pays the bet's cash-out at the current multiplier. Only while flying, and never after the crash.
function rkOut(now){const b=RKG.bet,fl=RKG.fly;if(!b||b.cashed||!fl||fl.id!==b.id)return;const t=(now-fl.start)/1000;if(t<0)return;
  const end=Math.min(Math.log(fl.cp)/RKG.k,(RKG.slot-RKG.win)/1000);if(t>=end)return;
  const m=rkMult(t),pay=Math.floor(Math.round(b.amt*m*100)/100);b.cashed=m;me.cash+=pay;saveArsenal();RKG.last=`Cashed out at ${m.toFixed(2)}x: +${fmtCash(pay-b.amt)}`}
function rkPlace(){const now=Date.now(),s=rkS(now),amt=RKG.amt;if(now>=s.start){RKG.last='Bets are closed. Wait for the next launch.';return}
  if(RKG.bet){RKG.last='You already have a bet on this launch.';return}
  if(me.cash<amt){RKG.last='Not enough cash for that bet.';return}
  me.cash-=amt;RKG.bet={id:s.id,amt,cashed:0};saveArsenal();RKG.last=`Bet ${fmtCash(amt)} placed. Cash out before it crashes.`}
function rkSettle(now){const b=RKG.bet,s=rkS(now),f=rkFlight(s.id,s.start);if(f)RKG.fly=f;const fl=RKG.fly;
  if(b&&b.id<s.id){if(!b.cashed)RKG.last=`Crashed. Lost ${fmtCash(b.amt)}.`;RKG.bet=null}
  if(!fl||fl.id!==s.id||now<fl.start)return null;
  const tc=Math.log(fl.cp)/RKG.k,end=Math.min(tc,(RKG.slot-RKG.win)/1000),t=(now-fl.start)/1000,crashed=t>=end,cm=tc>end?rkMult(end):fl.cp;
  if(crashed&&RKG.histId!==fl.id){RKG.histId=fl.id;RKG.hist.unshift(cm);if(RKG.hist.length>10)RKG.hist.length=10;RKG.histDirty=true;
    if(b&&b.id===fl.id&&!b.cashed){RKG.last=`Crashed at ${cm.toFixed(2)}x. Lost ${fmtCash(b.amt)}.`;RKG.bet=null}}
  return{cm,crashed,t:Math.min(t,end)}}
const rkC=$('rkc'),rkG=rkC.getContext('2d'),RKW=640,RKH=360;
function rkDraw(now,dt,st){const g=rkG,fl=RKG.fly&&RKG.fly.id===rkS(now).id&&now>=RKG.fly.start?RKG.fly:null,cam=RKG.cam;
  const t=st?st.t:0,cm=st?(st.crashed?st.cm:rkMult(t)):1;
  cam.x+=(Math.max(8,t*1.15)-cam.x)*Math.min(1,dt*3);cam.y+=(Math.max(2,cm*1.15)-cam.y)*Math.min(1,dt*3);
  const X=v=>56+v/cam.x*(RKW-80),Y=m=>RKH-34-(m-1)/(cam.y-1)*(RKH-64);
  g.setTransform(1,0,0,1,0,0);const bg=g.createLinearGradient(0,0,0,RKH);bg.addColorStop(0,'#0c0a1f');bg.addColorStop(1,'#2a1040');g.fillStyle=bg;g.fillRect(0,0,RKW,RKH);
  g.strokeStyle='rgba(255,255,255,.08)';g.lineWidth=1;g.font='600 12px "Chakra Petch",sans-serif';g.fillStyle='rgba(230,220,255,.6)';g.textAlign='left';g.textBaseline='middle';
  for(let i=1;i<=5;i++){const m=1+(cam.y-1)*i/5;g.beginPath();g.moveTo(56,Y(m));g.lineTo(RKW-24,Y(m));g.stroke();g.fillText(m.toFixed(2)+'x',8,Y(m))}
  const sx=Math.max(1,Math.ceil(cam.x/8));for(let s=0;s<=cam.x;s+=sx){g.beginPath();g.moveTo(X(s),24);g.lineTo(X(s),RKH-34);g.stroke();g.fillText(s+'s',X(s)-6,RKH-14)}
  let hx=70,hy=RKH-60,ang=-Math.PI/4;
  if(fl){const n=Math.max(2,Math.ceil(t*30));g.beginPath();for(let i=0;i<=n;i++){const tt=t*i/n,px=X(tt),py=Y(rkMult(tt));i?g.lineTo(px,py):g.moveTo(px,py)}
    const ln=g.createLinearGradient(56,0,RKW,0);ln.addColorStop(0,'#29e6d6');ln.addColorStop(1,st.crashed?'#ff4b4b':'#ff3ea5');
    g.lineWidth=5;g.strokeStyle=ln;g.shadowColor=st.crashed?'#ff4b4b':'#ff3ea5';g.shadowBlur=18;g.stroke();g.shadowBlur=0;
    g.lineTo(X(t),RKH-34);g.lineTo(56,RKH-34);g.closePath();g.fillStyle='rgba(255,62,165,.12)';g.fill();
    hx=X(t);hy=Y(cm);ang=Math.atan2(Y(rkMult(Math.max(0,t-.1)))-hy,hx-X(Math.max(0,t-.1)));if(!(Math.abs(ang)<=Math.PI))ang=-Math.PI/4}
  if(fl&&!st.crashed&&Math.random()<.9)RKG.parts.push({x:hx,y:hy,vx:-Math.cos(ang)*(50+Math.random()*60)+(Math.random()-.5)*30,vy:-Math.sin(ang)*(50+Math.random()*60)+(Math.random()-.5)*30,l:1});
  if(fl&&st.crashed&&RKG.boomId!==fl.id){RKG.boomId=fl.id;for(let i=0;i<46;i++){const a=Math.random()*TAU,v=60+Math.random()*180;RKG.parts.push({x:hx,y:hy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:1,c:Math.random()<.5?'#ff4b4b':'#ffc94a'})}}
  for(const p of RKG.parts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;p.l-=dt*1.4}
  RKG.parts=RKG.parts.filter(p=>p.l>0).slice(-200);
  g.save();for(const p of RKG.parts){g.globalAlpha=Math.max(0,p.l);g.fillStyle=p.c||'#ffc94a';g.beginPath();g.arc(p.x,p.y,2.5+p.l*2,0,TAU);g.fill()}g.restore();
  g.save();g.translate(hx,hy);g.rotate(ang);g.scale(4.2,4.2);
  if(fl&&!st.crashed){const L=20+Math.random()*12,fg=g.createLinearGradient(-14,0,-14-L,0);fg.addColorStop(0,'#fff3b8');fg.addColorStop(.35,'#ffc94a');fg.addColorStop(1,'rgba(255,62,165,0)');g.fillStyle=fg;g.beginPath();g.moveTo(-12,-7);g.quadraticCurveTo(-14-L*.6,-5,-14-L,0);g.quadraticCurveTo(-14-L*.6,5,-12,7);g.closePath();g.fill()}
  g.fillStyle=fl&&st.crashed?'#6a6470':'#f3ecff';g.beginPath();g.moveTo(20,0);g.quadraticCurveTo(4,-9,-14,-8);g.lineTo(-14,8);g.quadraticCurveTo(4,9,20,0);g.fill();
  g.fillStyle='#ff3ea5';g.beginPath();g.moveTo(-8,-8);g.lineTo(-18,-16);g.lineTo(-14,-4);g.fill();g.beginPath();g.moveTo(-8,8);g.lineTo(-18,16);g.lineTo(-14,4);g.fill();
  g.fillStyle='#29e6d6';g.beginPath();g.arc(4,0,3.5,0,TAU);g.fill();g.restore();
  const big=fl?(st.crashed?`CRASHED ${cm.toFixed(2)}x`:`${cm.toFixed(2)}x`):RKG.open&&now<rkS(now).start?`LAUNCH IN ${((rkS(now).start-now)/1000).toFixed(1)}s`:'WAITING';
  g.font='700 44px Bungee,Impact,sans-serif';g.textAlign='right';g.textBaseline='top';g.fillStyle=st&&st.crashed?'#ff4b4b':fl?'#f3ecff':'#ffc94a';g.shadowColor=g.fillStyle;g.shadowBlur=16;g.fillText(big,RKW-20,14);g.shadowBlur=0}
function rkUI(now){const s=rkS(now),bet=RKG.bet,inWin=now<s.start,fl=RKG.fly&&RKG.fly.id===s.id&&now>=RKG.fly.start,b=$('rkBet'),o=$('rkOut');
  const msg=RKG.last||(inWin?'Bets are open.':'Launch in progress.');if($('rkMsg').textContent!==msg)$('rkMsg').textContent=msg;
  b.textContent=bet?'Bet placed':`Bet ${fmtCash(RKG.amt)}`;b.disabled=!inWin||!!bet||me.cash<RKG.amt;
  const live=bet&&!bet.cashed&&fl;o.textContent=live?`Cash out ${fmtCash(Math.floor(Math.round(bet.amt*rkMult((now-RKG.fly.start)/1000)*100)/100))}`:'Cash out';o.disabled=!live;
  for(const c of document.querySelectorAll('#rkChips button'))c.classList.toggle('on',c.dataset.v===String(RKG.amt));
  if(RKG.histDirty){RKG.histDirty=false;const H=$('rkHist');H.replaceChildren();for(const v of RKG.hist){const e=document.createElement('span');e.className='rkh';e.style.background=v<2?'#5a1a2a':'#1a5a3a';e.textContent=v.toFixed(2)+'x';H.appendChild(e)}}}
function rkLoop(){RKG.raf=0;const now=Date.now();
  if($('lrocket').hidden){if(RKG.open){RKG.open=false;const b=RKG.bet,fl=RKG.fly;if(b&&!b.cashed&&fl&&fl.id===b.id&&now>=fl.start)rkOut(now);else if(b&&!b.cashed&&now<rkS(now).start){me.cash+=b.amt;RKG.bet=null;saveArsenal()}}return}
  RKG.open=true;const dt=Math.min(.05,(now-(RKG.lt||now))/1000);RKG.lt=now;
  const st=rkSettle(now);rkDraw(now,dt,st);rkUI(now);RKG.raf=requestAnimationFrame(rkLoop)}
function openRocket(){openModal('lrocket');RKG.open=true;RKG.lt=0;rkUI(Date.now());if(!RKG.raf)RKG.raf=requestAnimationFrame(rkLoop);$('rkBet').focus()}
for(const v of[10,50,100,500,1000]){const b=document.createElement('button');b.type='button';b.className='b chip';b.dataset.v=String(v);b.textContent='$'+v;b.addEventListener('click',()=>{RKG.amt=v});$('rkChips').appendChild(b)}
$('rkBet').addEventListener('click',rkPlace);
$('rkOut').addEventListener('click',()=>rkOut(Date.now()));

// ---------- Three Card Poker ----------
// Ante and optional Pair Plus against the dealer. The dealer qualifies with Queen high. Ante bonus pays on a played
// straight or better, whatever the dealer holds. Pair Plus pays on your hand alone, even after a fold.
const TCP_RK=['2','3','4','5','6','7','8','9','10','J','Q','K','A'],TCP_SU=['♠','♥','♦','♣'];
const TCP_NAME={6:'Straight flush',5:'Three of a kind',4:'Straight',3:'Flush',2:'Pair',1:'High card'};
const TCP_PP={6:40,5:30,4:6,3:3,2:1},TCP_AB={6:5,5:4,4:1};
const tcp={ante:10,pp:0,p:[],d:[],phase:'bet',msg:'Place your ante.'};
function tcpDeck(){const d=[];for(const su of TCP_SU)for(let r=0;r<13;r++)d.push([r+2,su]);for(let i=d.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[d[i],d[j]]=[d[j],d[i]]}return d}
// cat: 6 straight flush, 5 trips, 4 straight, 3 flush, 2 pair, 1 high card. ks: ranks to compare, best first. Ace is low only in A-2-3.
function tcpEval(h){const v=h.map(c=>c[0]).sort((a,b)=>b-a),fl=h[0][1]===h[1][1]&&h[1][1]===h[2][1];
  let st=v[0]-v[1]===1&&v[1]-v[2]===1,sh=v[0];if(!st&&v[0]===14&&v[1]===3&&v[2]===2){st=true;sh=3}
  if(st&&fl)return{cat:6,ks:[sh]};if(v[0]===v[2])return{cat:5,ks:[v[0]]};if(st)return{cat:4,ks:[sh]};if(fl)return{cat:3,ks:v};
  if(v[0]===v[1])return{cat:2,ks:[v[0],v[2]]};if(v[1]===v[2])return{cat:2,ks:[v[1],v[0]]};return{cat:1,ks:v}}
function tcpCmp(a,b){if(a.cat!==b.cat)return a.cat-b.cat;for(let i=0;i<a.ks.length;i++)if(a.ks[i]!==b.ks[i])return a.ks[i]-b.ks[i];return 0}
// Strategy for the RTP check: play on a pair or better, or on high card Q-6-4 or better.
const tcpPlays=e=>e.cat>1||tcpCmp(e,{cat:1,ks:[12,6,4]})>=0;
// Returns what comes back to the player for ante and play (ret), and for Pair Plus (ppRet). Both include the stakes.
function tcpPay(p,d,play,ante,pp){const pe=tcpEval(p),de=tcpEval(d),ppRet=pp&&TCP_PP[pe.cat]?pp*(TCP_PP[pe.cat]+1):0;let ret=0;
  if(play){const dq=de.cat>1||de.ks[0]>=12,c=tcpCmp(pe,de);
    if(!dq)ret=ante*3;else if(c>0)ret=ante*4;else if(c===0)ret=ante*2;
    ret+=ante*(TCP_AB[pe.cat]||0)}
  return{ret,ppRet,total:ret+ppRet,pe,de}}
// RTP of ante and play with the strategy above. Pair Plus is left out. Seeded so the result repeats.
function pokerRTP(n){const keep=rand;rand=seeded(9021);let ret=0,wag=0;try{for(let i=0;i<n;i++){const d=tcpDeck(),p=[d[0],d[2],d[4]],de=[d[1],d[3],d[5]],play=tcpPlays(tcpEval(p));ret+=tcpPay(p,de,play,1,0).ret;wag+=play?2:1}}finally{rand=keep}return ret/wag}
function tcpCard(c,down,fly){const e=document.createElement('div');e.className='tcpc';const i=document.createElement('div');i.className='tcpi'+(down?' down':'');
  const f=document.createElement('div');f.className='tcpf'+(c[1]==='♥'||c[1]==='♦'?' red':'');const a=document.createElement('span');a.textContent=TCP_RK[c[0]-2];const b=document.createElement('span');b.className='tcps';b.textContent=c[1];f.append(a,b);
  const k=document.createElement('div');k.className='tcpb';i.append(f,k);e.appendChild(i);
  if(fly){e.classList.add('fly');setTimeout(()=>requestAnimationFrame(()=>e.classList.remove('fly')),fly)}return e}
function tcpCash(){return fmtCash(me.cash)}
function tcpRender(){
  $('tcpCash').textContent=tcpCash();$('tcpMsg').textContent=tcp.msg;
  const done=tcp.phase==='done',show=tcp.phase!=='bet';
  $('tcpDv').textContent=show&&tcp.d.length?(done?' '+TCP_NAME[tcpEval(tcp.d).cat]:' ?'):'';
  $('tcpPv').textContent=tcp.p.length?' '+TCP_NAME[tcpEval(tcp.p).cat]:'';
  const cards=(arr,down,fly)=>arr.map((c,i)=>tcpCard(c,down(i),fly?fly+i*160:0));
  $('tcpD').replaceChildren(...cards(tcp.d,i=>!done,0));$('tcpP').replaceChildren(...cards(tcp.p,()=>false,0));
  for(const[id,v,arr]of[['tcpAnte',tcp.ante,[10,50,100,500]],['tcpPP',tcp.pp,[0,10,25,50]]]){const R=$(id);R.replaceChildren();
    for(const x of arr){const b=document.createElement('button');b.type='button';b.className='cb c'+x+(x===v?' on':'');b.textContent=x?'$'+x:'Off';b.disabled=tcp.phase!=='bet';b.addEventListener('click',()=>{if(id==='tcpAnte')tcp.ante=x;else tcp.pp=x;tcpRender()});R.appendChild(b)}}
  const A=$('tcpAct');A.replaceChildren();
  const btn=(t,fn,dis,cls)=>{const b=document.createElement('button');b.type='button';b.className='b'+(cls?' '+cls:'');b.textContent=t;b.disabled=!!dis;b.addEventListener('click',fn);A.appendChild(b)};
  if(tcp.phase==='bet')btn(`Deal ($${tcp.ante+tcp.pp})`,tcpDeal,tcp.ante<=0||me.cash<tcp.ante+tcp.pp,'go');
  else if(tcp.phase==='decide'){btn(`Play (+$${tcp.ante})`,()=>tcpResolve(true),me.cash<tcp.ante,'go');btn('Fold',()=>tcpResolve(false),false)}
  else btn('Deal again',()=>{tcp.phase='bet';tcp.p=[];tcp.d=[];tcp.msg='Place your bets.';tcpRender()},me.cash<tcp.ante+tcp.pp,'go');
}
function tcpDeal(){if(tcp.phase!=='bet')return;const cost=tcp.ante+tcp.pp;
  if(tcp.ante<=0||me.cash<cost){tcp.msg='Not enough cash for that ante.';tcpRender();return}
  me.cash-=cost;saveArsenal();const dk=tcpDeck();tcp.p=[dk[0],dk[2],dk[4]];tcp.d=[dk[1],dk[3],dk[5]];tcp.phase='decide';
  tcp.msg='Play for one more ante, or fold.';noise(.12,5000,.08);tcpRender();
  $('tcpP').replaceChildren(...tcp.p.map((c,i)=>tcpCard(c,false,i*160)));$('tcpD').replaceChildren(...tcp.d.map((c,i)=>tcpCard(c,true,i*160)))}
function tcpResolve(play){if(tcp.phase!=='decide')return;if(play&&me.cash<tcp.ante){tcp.msg='Not enough cash to play. Fold or leave.';tcpRender();return}
  if(play){me.cash-=tcp.ante;saveArsenal()}
  const r=tcpPay(tcp.p,tcp.d,play,tcp.ante,tcp.pp);me.cash+=r.total;saveArsenal();tcp.phase='done';
  const wag=tcp.ante+tcp.pp+(play?tcp.ante:0),net=r.total-wag,dq=r.de.cat>1||r.de.ks[0]>=12;
  let m=!play?'You folded. Ante lost.':!dq?'Dealer does not qualify. Ante and play returned.':tcpCmp(r.pe,r.de)>0?'You beat the dealer.':tcpCmp(r.pe,r.de)===0?'Push.':'Dealer wins.';
  if(play&&dq&&tcpCmp(r.pe,r.de)<0)m='Dealer wins.';
  if(r.ppRet)m+=` Pair Plus: ${TCP_NAME[r.pe.cat]} pays ${fmtCash(r.ppRet-tcp.pp)}.`;
  if(play&&(TCP_AB[r.pe.cat]||0))m+=` Ante bonus ${fmtCash(tcp.ante*TCP_AB[r.pe.cat])}.`;
  tcp.msg=`${m} ${net>0?'+':net<0?'-':''}${fmtCash(Math.abs(net))}`;
  if(net>0){jingle('pass');if(net>=5000)feed(`Three Card Poker: +${fmtCash(net)}`)}else noise(.2,400,.06);
  tcpRender();const win=tcpCmp(r.pe,r.de)>0||r.ppRet>0;$('tcpP').querySelectorAll('.tcpc').forEach(e=>e.classList.toggle('win',win))}
function openTCP(){openModal('tcp');tcpRender()}

// ---------- Horse racing ----------
// Six horses, a 20 s race. Each race draws its odds from the horse weights: a win pays 0.9 / p, so every
// horse returns 90 percent on average. The finish order is drawn with the same probabilities (Plackett-Luce),
// and place pays when the horse finishes top two at 0.9 / P(top two). The race is decided at the start.
const HR_NAMES=['Lucky Strike','Neon Comet','Palm Thunder','Midnight Miss','Gold Rush','Sunset Bolt'],HR_COL=['#ff3ea5','#29e6d6','#ffc94a','#7b6bff','#3dd68c','#ff6b3d'],HR_BASE=[5,4,3,2,1.5,1];
const HRS={p:[],D:[],Dp:[],sel:0,amt:50,bets:[],run:false,order:[],T:[],t0:0,last:'',board:[]};
const hrC=$('hrc'),hrG=hrC.getContext('2d'),HRW=640,HRH=360,HRX0=134,HRX1=588;
// Draws a finish order with the given win probabilities (each pick removes the horse from the pool).
function horsePick(p){const q=p.slice(),out=[];for(let k=0;k<p.length;k++){const tot=q.reduce((a,b)=>a+b,0);let x=rand()*tot,i=0;while(i<q.length-1&&(q[i]===0||x>=q[i])){x-=q[i];i++}out.push(i);q[i]=0}return out}
function hrProbs(w){const s=w.reduce((a,b)=>a+b,0);return w.map(x=>x/s)}
function hrOdds(p){const D=p.map(x=>0.9/x),Dp=p.map((x,i)=>{let p2=x;for(let j=0;j<p.length;j++)if(j!==i)p2+=p[j]*x/(1-p[j]);return 0.9/p2});return{D,Dp}}
function hrCard(){HRS.p=hrProbs(HR_BASE.map(b=>b*(.8+.4*rand())));const o=hrOdds(HRS.p);HRS.D=o.D;HRS.Dp=o.Dp}
// Win (k 'w') or place (k 'p') bet on the horse picked in the list.
function hrBet(k){if(HRS.run){HRS.last='Bets close when the race starts.';hrRender();return}
  if(me.cash<HRS.amt){HRS.last='Not enough cash for that bet.';hrRender();return}
  me.cash-=HRS.amt;saveArsenal();HRS.bets.push({k,h:HRS.sel,amt:HRS.amt});HRS.last=`${k==='w'?'Win':'Place'} bet ${fmtCash(HRS.amt)} on ${HR_NAMES[HRS.sel]}.`;hrRender()}
function hrClear(){if(HRS.run)return;for(const b of HRS.bets)me.cash+=b.amt;HRS.bets=[];saveArsenal();HRS.last='Bets returned.';hrRender()}
function hrStart(){if(HRS.run)return;if(!HRS.bets.length){HRS.last='Place a bet first. Pick a horse, then win or place.';hrRender();return}
  HRS.order=horsePick(HRS.p);HRS.run=true;for(let k=0;k<6;k++)HRS.T[HRS.order[k]]=17.2+k*.55+(rand()-.5)*.12;
  HRS.t0=performance.now();HRS.last='And they are off.';noise(.3,800,.1);hrRender();setTimeout(hrSettle,20800)}
// Pays every bet once, then clears them and draws the next card. Runs on a timer, so closing the modal does not stop it.
function hrSettle(){const o=HRS.order,win=o[0],top=o.slice(0,2);let pay=0,stake=0;
  for(const b of HRS.bets){stake+=b.amt;const hit=b.k==='w'?b.h===win:top.includes(b.h);if(hit)pay+=Math.floor(Math.round(b.amt*(b.k==='w'?HRS.D[b.h]:HRS.Dp[b.h])*100)/100)}
  me.cash+=pay;saveArsenal();HRS.run=false;HRS.board.unshift(o.slice(0,3));if(HRS.board.length>5)HRS.board.length=5;
  const net=pay-stake;HRS.last=`${HR_NAMES[win]} wins. ${!stake?'No bets this race.':net>0?'You win '+fmtCash(net)+'.':net<0?'You lose '+fmtCash(-net)+'.':'Break even.'}`;
  HRS.bets=[];if(net>0)jingle('pass');hrCard();hrRender()}
// Position along the track, 0 at the gate and 1 at the line. A small wave makes the horses swap places mid-race.
function hrPos(i,t){const x=t/HRS.T[i];if(x>=1)return 1;const n=Math.sin(t*(1.1+i*.23)+i*1.7)*.05*x*(1-x)*4;return Math.max(0,Math.min(1,x+n))}
// Side view, facing the finish. Legs run a gallop cycle while moving. The jockey wears the horse's colour.
const HR_COAT=['#8a4a22','#4a2a18','#c9c1b0','#6b3a1e','#a0703c','#2a1a12'];
function hrHorse(g,x,y,c,n,ph,moving){const k=moving?1:0,bob=k*Math.abs(Math.sin(ph*2))*1.6,coat=HR_COAT[(n-1)%6],dark='#1a1008',L=20;
  const leg=(hx,p,col)=>{const a=k*Math.sin(p)*.7,fx=hx+Math.sin(a)*L*.8,fy=-20+Math.cos(a)*L;g.strokeStyle=col;g.lineWidth=3.2;g.beginPath();g.moveTo(hx,-20);g.lineTo(fx,fy);g.stroke();g.fillStyle=dark;g.fillRect(fx-2.5,-2.2,5,2.2)};
  g.save();g.translate(x,y-bob);g.scale(.72,.72);g.lineCap='round';g.lineJoin='round';
  leg(-14,ph+Math.PI+.5,'#2a1a10');leg(8,ph+.5,'#2a1a10');
  g.strokeStyle=dark;g.lineWidth=3;g.beginPath();g.moveTo(-18,-30);g.quadraticCurveTo(-36,-30+k*Math.sin(ph)*3,-32,-12);g.stroke();
  g.fillStyle=coat;g.strokeStyle=dark;g.lineWidth=1.2;
  g.beginPath();g.ellipse(-1,-28,19,8.5,-.08,0,TAU);g.fill();g.stroke();
  g.beginPath();g.moveTo(8,-34);g.lineTo(22,-50);g.lineTo(30,-46);g.lineTo(18,-25);g.closePath();g.fill();g.stroke();
  g.beginPath();g.ellipse(31,-44,7.5,4.6,-.7,0,TAU);g.fill();g.stroke();
  g.beginPath();g.moveTo(22,-49);g.lineTo(23.5,-57);g.lineTo(27,-50);g.closePath();g.fill();g.stroke();
  g.strokeStyle=dark;g.lineWidth=2.6;g.beginPath();g.moveTo(10,-35);g.lineTo(22,-50);g.stroke();
  g.fillStyle='#fff';g.beginPath();g.arc(28,-46,1.1,0,TAU);g.fill();
  leg(-12,ph+2.4,coat);leg(4,ph,coat);
  g.fillStyle=c;g.beginPath();g.moveTo(-7,-34);g.lineTo(6,-34);g.lineTo(6,-25);g.lineTo(-7,-25);g.closePath();g.fill();
  g.fillStyle='#fff';g.font='700 7px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(String(n),-0.5,-29.5);
  g.fillStyle=c;g.beginPath();g.moveTo(-5,-38);g.lineTo(2,-46);g.lineTo(9,-43);g.lineTo(0,-34);g.closePath();g.fill();
  g.strokeStyle=c;g.lineWidth=2.6;g.beginPath();g.moveTo(6,-43);g.lineTo(16,-37);g.stroke();
  g.strokeStyle='#f3ecff';g.lineWidth=2.4;g.beginPath();g.moveTo(-3,-35);g.lineTo(3,-24);g.stroke();
  g.fillStyle='#e0b48f';g.beginPath();g.arc(10,-49,3.6,0,TAU);g.fill();
  g.fillStyle=c;g.beginPath();g.arc(10,-49.5,4,Math.PI,0);g.fill();
  g.restore()}
function hrDraw(now){const g=hrG,run=HRS.run,t=run?(now-HRS.t0)/1000:0;g.setTransform(1,0,0,1,0,0);
  const sky=g.createLinearGradient(0,0,0,70);sky.addColorStop(0,'#0b0a16');sky.addColorStop(1,'#241a14');g.fillStyle=sky;g.fillRect(0,0,HRW,70);
  g.fillStyle='rgba(255,201,74,.85)';for(let i=0;i<9;i++){g.fillRect(40+i*66,18,40,4)}
  g.fillStyle='#2d5a2a';g.fillRect(0,70,HRW,8);
  const L0=HRS.run||HRS.order.length?HRS.order:null;
  const lane=(HRH-88)/6;
  g.fillStyle='#6a4426';g.fillRect(0,78,HRW,HRH-78);
  for(let k=0;k<6;k++){g.fillStyle=k%2?'rgba(0,0,0,.12)':'rgba(255,255,255,.04)';g.fillRect(0,78+k*lane,HRW,lane)}
  g.strokeStyle='rgba(255,255,255,.45)';g.lineWidth=1.5;g.setLineDash([10,8]);for(let k=0;k<=6;k++){g.beginPath();g.moveTo(0,78+k*lane);g.lineTo(HRW,78+k*lane);g.stroke()}g.setLineDash([]);
  g.fillStyle='#e8e0d0';g.fillRect(HRX0-10,78,4,HRH-78);
  for(let i=0;i<8;i++){g.fillStyle=i%2?'#111':'#f3ecff';g.fillRect(HRX1+4,78+i*(HRH-78)/8,10,(HRH-78)/8)}
  for(let i=0;i<6;i++){const y=78+lane*(i+.5),x=HRX0+(run||L0?hrPos(i,t):0)*(HRX1-HRX0);hrHorse(g,x,y+12,HR_COL[i],i+1,t*(6+i*.3)+i,run&&x<HRX1)}
  g.textAlign='left';g.textBaseline='middle';g.font='700 13px "Chakra Petch",sans-serif';
  for(let i=0;i<6;i++){g.fillStyle='rgba(255,255,255,.9)';g.fillText(`${i+1}  ${HR_NAMES[i]}`,8,78+lane*(i+.5))}
  g.fillStyle='#ffc94a';g.textAlign='right';g.font='700 16px "Chakra Petch",sans-serif';g.fillText(run?`${Math.min(20,t).toFixed(1)} s`:'Ready',HRW-10,HRH-10)}
function hrRender(){
  $('hrCash').textContent=fmtCash(me.cash);$('hrMsg').textContent=HRS.last;
  const O=$('hrOdds');O.replaceChildren();
  HR_NAMES.forEach((n,i)=>{const b=document.createElement('button');b.type='button';if(i===HRS.sel)b.className='on';b.disabled=HRS.run;
    const a=document.createElement('span');a.textContent=`${i+1}. ${n}`;const sm=document.createElement('small');sm.textContent=`win ${HRS.D[i]?HRS.D[i].toFixed(2):'-'}x · place ${HRS.Dp[i]?HRS.Dp[i].toFixed(2):'-'}x`;
    b.append(a,sm);b.addEventListener('click',()=>{HRS.sel=i;hrRender()});O.appendChild(b)});
  const C=$('hrChips');C.replaceChildren();for(const v of[10,50,100,500]){const b=document.createElement('button');b.type='button';b.className='b chip'+(HRS.amt===v?' on':'');b.textContent='$'+v;b.addEventListener('click',()=>{HRS.amt=v;hrRender()});C.appendChild(b)}
  const A=$('hrAct');A.replaceChildren();
  const btn=(t,fn,dis,cls)=>{const b=document.createElement('button');b.type='button';b.className='b'+(cls?' '+cls:'');b.textContent=t;b.disabled=!!dis;b.addEventListener('click',fn);A.appendChild(b)};
  btn(`Win $${HRS.amt}`,()=>hrBet('w'),HRS.run||me.cash<HRS.amt,'go');btn(`Place $${HRS.amt}`,()=>hrBet('p'),HRS.run||me.cash<HRS.amt);
  btn(HRS.run?'Racing...':'Run the race',hrStart,HRS.run||!HRS.bets.length,'go');btn('Clear bets',hrClear,HRS.run||!HRS.bets.length);
  const Bd=$('hrBoard');Bd.replaceChildren();for(const r of HRS.board){const e=document.createElement('span');e.textContent=r.map(i=>HR_NAMES[i]).join(' · ');Bd.appendChild(e)}
}
function hrLoop(){if($('horses').hidden)return;hrDraw(performance.now());requestAnimationFrame(hrLoop)}
function openHorses(){openModal('horses');if(!HRS.p.length)hrCard();hrRender();hrDraw(performance.now());requestAnimationFrame(hrLoop)}
// Test helpers: the same draw and payout rules with a seeded rand. Win and place each return about 0.9.
function horseRTP(n){const keep=rand;rand=seeded(3307);let ret=0;try{const p=hrProbs(HR_BASE),D=hrOdds(p).D;for(let i=0;i<n;i++){const h=i%6;if(horsePick(p)[0]===h)ret+=D[h]}}finally{rand=keep}return ret/n}
function horsePlaceRTP(n){const keep=rand;rand=seeded(3308);let ret=0;try{const p=hrProbs(HR_BASE),Dp=hrOdds(p).Dp;for(let i=0;i<n;i++){const h=i%6;if(horsePick(p).slice(0,2).includes(h))ret+=Dp[h]}}finally{rand=keep}return ret/n}
if(DBG)Object.defineProperties(DBG,{enterInt:{get:()=>enterInt},spinWheel:{get:()=>spinWheel},wheelValue:{get:()=>wheelValue},rocketRTP:{get:()=>rocketRTP},pokerRTP:{get:()=>pokerRTP},horseRTP:{get:()=>horseRTP},horsePlaceRTP:{get:()=>horsePlaceRTP},rkS:{get:()=>rkS},drawCalls:{get:()=>renderer.info.render.calls}});

// ---------- Neon 7s ----------
// One line, three reels. Cherries pay anywhere on the line, three of a kind pays on the line. Strips hold 20 stops each.
const N7NAME=['Cherry','Lemon','Bar','Double bar','Bell','7','Neon 7'];
const N7STRIP=(()=>{const a=[0,1,2,3,4,1,0,2,5,1,3,0,4,2,6,1,3,4,2,5];return[a,a.slice().reverse(),a.slice(7).concat(a.slice(0,7))]})();
const N7CH=[0,1,3,10],N7TRI=[0,5,10,20,30,100,150];
function n7Eval(a){const k=a.filter(s=>s===0).length;if(k)return N7CH[k];return a[0]===a[1]&&a[1]===a[2]?N7TRI[a[0]]:0}
function n7Spin(){const si=[0,1,2].map(()=>(rand()*20)|0);return{si,a:si.map((s,r)=>N7STRIP[r][s])}}
const s7={el:$('slots7'),bet:25,busy:false,msg:'Pick a bet and pull.',reels:[0,1,2].map(()=>({p:0,v:0,s:'idle'})),wv:0,shown:0,line:0,skip:false,wq:[]};
// Stop i moves forward from its position: eased travel, then a small nudge back and forth.
function s7Stop(r,si){const d0=((si-r.p)%20+20)%20,d=d0<1.5?d0+20:d0;r.s='tween';r.p0=r.p;r.d=d;r.t0=performance.now();r.dur=slT(420+d*30)}
function s7Step(now,dt){for(const r of s7.reels){
  if(r.s==='spin'){r.v=Math.min(24,r.v+dt*70);r.p+=r.v*dt}
  else if(r.s==='tween'){const q=Math.min(1,(now-r.t0)/r.dur);r.p=r.p0+r.d*(1-Math.pow(1-q,3));if(q>=1){r.s='bump';r.t0=now}}
  else if(r.s==='bump'){const b=Math.min(1,(now-r.t0)/slT(220));r.p=r.p0+r.d-.12*Math.sin(Math.PI*b);if(b>=1){r.s='idle';r.p=r.p0+r.d}}
  r.p=((r.p%20)+20)%20}}
async function s7Spin(){const m=s7;if(m.busy)return;if(me.cash<m.bet){m.msg='Not enough cash.';s7UI();return}
  me.cash-=m.bet;saveArsenal();m.busy=true;m.wv=0;m.line=0;m.msg='Good luck.';s7UI();
  const n=n7Spin(),w=n7Eval(n.a)*m.bet;
  m.reels.forEach(r=>{r.s='spin';r.v=0});sfx(.5,'bandpass',900,.04);
  for(let i=0;i<3;i++){await slWait(m,slT(i?380:900));s7Stop(m.reels[i],n.si[i]);sfx(.05,'bandpass',1500,.12)}
  await slWait(m,m.reels[2].dur+240);
  if(w>0){me.cash+=w;m.wv=w;m.line=performance.now();if(w>=m.bet*20)jingle('pass');else tone('triangle',mf(84),.25,.09)}
  const k=n.a.filter(s=>s===0).length;
  m.msg=w?(k?`${k} cherr${k>1?'ies':'y'} pay $${w.toLocaleString('en-US')}`:`Three ${N7NAME[n.a[0]]} pay $${w.toLocaleString('en-US')}`):'No win.';
  m.busy=false;saveArsenal();s7UI()}
function s7UI(){const m=s7;$('s7Msg').textContent=`${m.msg}  Cash $${me.cash.toLocaleString('en-US')}`;const A=$('s7Act');A.replaceChildren();
  for(const v of[25,100,250,1000,2500])mkBtn(A,'$'+v.toLocaleString('en-US'),()=>{if(!m.busy){m.bet=v;s7UI()}},'chip'+(m.bet===v?' on':''),m.busy);
  mkBtn(A,m.busy?'Spinning...':`Pull $${m.bet.toLocaleString('en-US')}`,s7Spin,'go',m.busy||me.cash<m.bet)}
function s7Draw(now,dt){
  const g=slFit($('s7c'),640,380),k=g.canvas.width/640,S=Math.round(96*k),FF='Bungee,Impact,sans-serif';
  s7Step(now,dt);s7.shown+=(s7.wv-s7.shown)*Math.min(1,dt*9);
  const bg=g.createLinearGradient(0,0,0,380);bg.addColorStop(0,'#24093a');bg.addColorStop(1,'#07030f');g.fillStyle=bg;g.fillRect(0,0,640,380);
  g.fillStyle='#050208';g.strokeStyle='#ffd84a';g.lineWidth=3;g.shadowColor='#ffd84a';g.shadowBlur=18;g.beginPath();g.roundRect(70,22,500,276,16);g.fill();g.stroke();g.shadowBlur=0;
  const lit=s7.line&&now-s7.line<1600;
  s7.reels.forEach((r,i)=>{const x=75+i*170,sp=r.s==='spin'?r.v:0;
    g.save();g.beginPath();g.rect(x,26,150,268);g.clip();
    g.fillStyle='#120a1e';g.fillRect(x,26,150,268);
    for(let j=-3;j<=3;j++){const q=Math.floor(r.p)+j,y=160-(q-r.p)*86,sy=N7STRIP[i][((q%20)+20)%20],mid=j===0,pulse=mid&&lit?1+.07*Math.sin(now/90):1;
      const spr=slSpr('n'+sy,S);
      if(sp>8){g.globalAlpha=.22;g.drawImage(spr,x+75-48,y-48-Math.min(24,sp*1.1),96,96);g.drawImage(spr,x+75-48,y-48+Math.min(24,sp*1.1),96,96);g.globalAlpha=1}
      g.save();g.translate(x+75,y);g.scale(pulse,pulse);g.drawImage(spr,-48,-48,96,96);g.restore()}
    const f1=g.createLinearGradient(0,26,0,96);f1.addColorStop(0,'rgba(5,2,8,1)');f1.addColorStop(1,'rgba(5,2,8,0)');g.fillStyle=f1;g.fillRect(x,26,150,70);
    const f2=g.createLinearGradient(0,240,0,294);f2.addColorStop(0,'rgba(5,2,8,0)');f2.addColorStop(1,'rgba(5,2,8,1)');g.fillStyle=f2;g.fillRect(x,240,150,54);
    g.restore()});
  // payline
  g.save();g.strokeStyle=lit?'#fff3a6':'rgba(255,216,74,.35)';g.lineWidth=lit?4:2;g.shadowColor='#ffd84a';g.shadowBlur=lit?22:6;
  g.beginPath();g.moveTo(54,160);g.lineTo(586,160);g.stroke();g.restore();
  g.fillStyle='#ffd84a';g.beginPath();g.moveTo(44,150);g.lineTo(60,160);g.lineTo(44,170);g.fill();g.beginPath();g.moveTo(596,150);g.lineTo(580,160);g.lineTo(596,170);g.fill();
  // counter
  g.textBaseline='middle';g.textAlign='left';g.fillStyle='#f3ecff';g.font='700 16px "Chakra Petch",system-ui,sans-serif';g.fillText('BET $'+s7.bet.toLocaleString('en-US'),40,340);
  g.textAlign='right';g.fillText('LINE 1',600,340);
  g.textAlign='center';g.save();g.shadowColor='#ff3ea5';g.shadowBlur=16;g.fillStyle='#ffe066';g.font='38px '+FF;g.fillText('$'+Math.round(s7.shown).toLocaleString('en-US'),320,340);g.restore()}

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
  if(heist.drilling&&!atDrill){heist.drilling=false;feed('You stepped away from the drill')}
  if(heist.drilling)drillers++;
  for(const r of crew()){heist.bits|=r.hs[1]&15;heist.drill=Math.max(heist.drill,r.hs[2]);if(r.hs[3])drillers++}
  if(heist.bits!==heist.seenBits){const nb=heist.bits&~heist.seenBits;heist.seenBits=heist.bits;if(nb&1)feed('Crew update: keycard found');if(nb&2)feed('Crew update: mainframe hacked');if(nb&8)feed('Crew update: the vault is open')}
  if(heist.drilling&&!(heist.bits&8)){heist.drill=Math.min(100,heist.drill+dt*100/30*(1+.6*(drillers-1)));if(rand()<dt*8)burst(bankV.ox+210+rr(-20,20),bankV.oy+34,3,'#ffd27a',120,.3)}
  if(heist.drill>=100&&!(heist.bits&8)){heist.bits|=8;heist.drilling=false;showBig('VAULT OPEN','#ffc94a','Grab the gold',2)}
  if(me.inside===bankV&&state==='play'&&!heist.alarm){for(let i=0;i<3;i++)if(Math.abs(me.y-laserY(i))<4&&me.x>bankV.ox+12&&me.x<bankV.ox+bankV.w-12){triggerAlarm('Laser tripped!');break}}
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
function openWheel(){if(state!=='play'||wheelOpen)return;wheelOpen=true;wheelSel=weap;wheelVec={x:0,y:0};mouse.down=false;$('wheel').hidden=false;paintWheel()}
function closeWheel(apply){if(!wheelOpen)return;wheelOpen=false;$('wheel').hidden=true;if(apply&&wheelSel&&owned[wheelSel]&&wheelSel!==weap){weap=wheelSel;feed(WEAPONS[WI[weap]].name+' equipped')}}
$('wheel').addEventListener('pointerdown',e=>{if(e.target.id==='wheel')closeWheel(false)});

// ---------- progression ----------
// Reputation points (RP) come from play. Levels unlock guns, vehicles and heists.
let xp=0,lv=1,maxHeatThisChase=0;
const need=L=>L<=1?0:Math.round(250*Math.pow(L-1,1.5));
const lvOf=x=>{let L=1;while(L<30&&x>=need(L+1))L++;return L};
const UNLOCK={smg:2,shotgun:3,mg:6,sniper:8,rpg:10,sticky:12,homing:15,heli:12,jet:20,bank:5,casinoHeist:8};
const UNLOCK_NAME={heli:'Attack helicopter',jet:'Fighter jets',bank:'Union Bank job',casinoHeist:'Casino cage robbery'};
const unlocked=k=>lv>=(UNLOCK[k]||1);
function unlockText(L){const a=Object.keys(UNLOCK).filter(k=>UNLOCK[k]===L).map(k=>UNLOCK_NAME[k]||WEAPONS.find(w=>w.id===k).name);return a.length?'Unlocked: '+a.join(', '):''}
function lvlBar(){const lb=$('lvl');lb.querySelector('b').textContent=lv;lb.querySelector('u').style.width=(lv>=30?100:clamp((xp-need(lv))/(need(lv+1)-need(lv))*100,0,100))+'%'}
function gainXP(n,why){n=Math.round(n);if(state!=='play'||!(n>0))return;xp+=n;feed(`+${n} RP · ${why}`);
  const nl=lvOf(xp);if(nl!==lv){lv=nl;showBig('LEVEL '+lv,'#29e6d6',unlockText(lv),2.2);saveArsenal()}lvlBar()}
if(DBG)Object.defineProperties(DBG,{xp:{get:()=>xp},lv:{get:()=>lv},gainXP:{get:()=>gainXP}});

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
  const free=()=>{let p;do{p=[Math.floor(Math.random()*16),Math.floor(Math.random()*16)]}while(s.body.some(b=>b[0]===p[0]&&b[1]===p[1]));return p};
  s.food=free();
  const end=()=>{s.over=true;const sc=s.foods*10;arc.tix+=s.foods;arc.hi[1]=Math.max(arc.hi[1],sc);saveArc();$('pmM').textContent=`Game over. Score ${sc}, +${s.foods} tickets.`;mkBtn($('pmB'),'Play again ($5)',startSnake)};
  s.step=()=>{s.dir=s.nd;const h=[s.body[0][0]+s.dir[0],s.body[0][1]+s.dir[1]];
    if(h[0]<0||h[1]<0||h[0]>15||h[1]>15||s.body.some(b=>b[0]===h[0]&&b[1]===h[1])){end();return}
    s.body.unshift(h);if(h[0]===s.food[0]&&h[1]===s.food[1]){s.foods++;s.food=free()}else s.body.pop()};
  s.key=c=>{const d={KeyW:[0,-1],ArrowUp:[0,-1],KeyS:[0,1],ArrowDown:[0,1],KeyA:[-1,0],ArrowLeft:[-1,0],KeyD:[1,0],ArrowRight:[1,0]}[c];if(d&&!(d[0]===-s.nd[0]&&d[1]===-s.nd[1]))s.nd=d};
  s.up=dt=>{if(s.over)return;s.acc+=dt;while(s.acc>=.12&&!s.over){s.acc-=.12;s.step()}};
  s.dr=()=>{const c=plC,z=20;c.fillStyle='#07050f';c.fillRect(0,0,320,320);c.strokeStyle='rgba(61,214,140,.12)';
    for(let i=0;i<=16;i++){c.beginPath();c.moveTo(i*z,0);c.lineTo(i*z,320);c.moveTo(0,i*z);c.lineTo(320,i*z);c.stroke()}
    c.fillStyle='#ff3ea5';c.beginPath();c.arc(s.food[0]*z+10,s.food[1]*z+10,6,0,TAU);c.fill();
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
// nitro: hold V in a car with nitro fitted for up to 3 s of boost. It refills in 10 s, in or out of the car. Sets c.boost for drive().
const nitBar=$('nitBar'),nitFill=$('nit');
function modNitroStep(dt){
  const c=me.car,fitted=!!c&&!!c.mods&&!!c.mods.nitro&&!c.burn,on=fitted&&state==='play'&&!!keys.KeyV;
  if(on&&nitroT>0)nitroT=Math.max(0,nitroT-dt);else nitroT=Math.min(nitroMax,nitroT+dt*nitroMax/10);
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
  if(modCat===4){const own=!!m.nitro,ready=lv>=6;
    modsBtnRow(L,'Nitro',own,own?'Hold V for 3 s of boost, refills in 10 s':'$6,000 · hold V for 3 s of boost, refills in 10 s',lab(own,ready,6000,6),ready&&!own&&me.cash>=6000,()=>modBuy(6000,()=>{m.nitro=1;nitroT=nitroMax}))}
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
  c.kind='mine';c.vx=0;c.vy=0;me.car=c;me.x=c.x;me.y=c.y;me.a=c.a;return 'ok'};
if(DBG)Object.defineProperties(DBG,{modK:{get:()=>modK},openMods:{get:()=>openMods}});
if(DBG)Object.defineProperties(DBG,{bait:{get:()=>bait}});
// ---------- jobs ----------
function jobCol(){return!job?'#ffc94a':job.col||(job.phase==='pickup'?'#ffc94a':'#ff3ea5')}
function endJob(){if(job&&job.car)job.car.mark=false}
function jobDone(reward,msg){endJob();me.cash+=reward;showBig('MISSION PASSED','#ffc94a',`+$${reward}`,2);jingle('pass');job={phase:'wait',t:4,msg:msg||'Nice work. Check your phone for the next job.'};gainXP(60+reward*.08,'Mission');saveArsenal()}
function jobFail(msg){endJob();jingle('fail');showBig('MISSION FAILED','#ff4b4b',msg,1.8);job={phase:'wait',t:4,msg:'Check your phone for the next job.'}}
const jobPos=()=>me.jet||me.heli||me.car||me;
function newJob(force){
  const kinds=['courier','hit','steal','race','wrecker','wanted','turf'],k=force||kinds[Math.floor(rand()*kinds.length)];
  if(k==='hit'){const c=laneSpawn('traffic',700,1400);if(c){c.color='#d23c5a';c.mark=true;job={type:k,phase:'go',car:c,x:c.x,y:c.y,title:'Hit job',text:'Destroy the marked red car.',col:'#ff4b4b',reward:1500,t:120,timed:true};return}}
  if(k==='steal'){const[sp]=parkSpot(700,1600);if(sp){const c=mkCar(sp[0],sp[1],sp[2],'parked','#e8c547','sports');c.color='#e8c547';c.mark=true;cars.push(c);job={type:k,phase:'go',car:c,x:c.x,y:c.y,title:'Grand theft',text:'Steal the gold sports car.',col:'#ffc94a',reward:2000};return}}
  if(k==='race'){let ci=clamp(Math.round((A.x-60)/B),0,N),cj=clamp(Math.round((A.y-60)/B),0,N),px=A.x,py=A.y,len=0;const pts=[];
    for(let n=0;n<6;n++){for(let tr=0;tr<12;tr++){const di=Math.floor(rand()*5)-2,dj=Math.floor(rand()*5)-2,ni=ci+di,nj=cj+dj;if((di||dj)&&ni>=0&&nj>=0&&ni<=N&&nj<=N){ci=ni;cj=nj;break}}const q=[ci*B+60,cj*B+60];len+=Math.hypot(q[0]-px,q[1]-py);px=q[0];py=q[1];pts.push(q)}
    job={type:k,phase:'go',pts,i:0,x:pts[0][0],y:pts[0][1],title:'Checkpoint rush',text:'Checkpoint 1 of 6. Any vehicle works.',col:'#29e6d6',reward:1200,t:Math.round(14+len/190),timed:true};return}
  if(k==='wrecker'){job={type:k,phase:'go',n:0,goal:5,x:A.x,y:A.y,noMarker:true,title:'Demolition',text:'Destroy vehicles: 0 of 5.',col:'#ff6b3d',reward:1300,t:80,timed:true};return}
  if(k==='wanted'&&!me.inside){heat=Math.max(heat,3);coolT=0;job={type:k,phase:'go',x:A.x,y:A.y,noMarker:true,title:'Heat run',text:'You have 3 stars. Lose the cops.',col:'#4aa3ff',reward:1000,t:150,timed:true};return}
  if(k==='turf'){const kg=rand()<.5,hq=kg?KINGSHQ:GANGHQ;job={type:k,phase:'go',n:0,goal:6,gname:kg?'Kings':'Vipers',x:hq.x,y:hq.y,title:'Turf war',text:kg?'Take out 6 Low Palms Kings in the hood.':'Take out 6 Rustwater Vipers at the docks.',col:kg?'#9a5ad8':'#3dd68c',reward:1800,t:180,timed:true};return}
  const[x,y]=pointAway(500,1200);job={type:'courier',phase:'pickup',x,y,title:'Courier · pickup',text:'Grab the package at the gold marker.',col:'#ffc94a'};
}
function jobStep(dt){
  if(!job){newJob('courier');return}
  if(job.phase==='wait'){job.t-=dt;return}
  const Pp=jobPos(),d=Math.hypot(job.x-Pp.x,job.y-Pp.y);
  if(job.timed){job.t-=dt;if(job.t<=0){jobFail(job.type==='wanted'?'The cops are still on you':'Out of time');return}}
  switch(job.type||'courier'){
    case'courier':
      if(job.phase==='pickup'&&d<38){const[x,y]=pointAway(900,1800),dist=Math.hypot(x-Pp.x,y-Pp.y);Object.assign(job,{phase:'drop',x,y,t:Math.round(dist/165+14),timed:true,reward:Math.round(150+dist*.12),title:'Courier · deliver',text:'Drop it at the pink marker.',col:'#ff3ea5'});noise(.15,5000,.15)}
      else if(job.phase==='drop'&&d<38)jobDone(job.reward);break;
    case'hit':if(!cars.includes(job.car)){jobFail('The target got away');break}job.x=job.car.x;job.y=job.car.y;if(job.car.kind==='dead')jobDone(job.reward);break;
    case'steal':{const c=job.car;if(!cars.includes(c)||c.kind==='dead'||c.burn){jobFail('The car got wrecked');break}
      if(job.phase==='go'){job.x=c.x;job.y=c.y;if(me.car===c)Object.assign(job,{phase:'drop',x:GARAGE.x,y:GARAGE.y,text:'Deliver it to the Rustwater Docks garage in one piece.',col:'#ff3ea5'})}
      else if(me.car===c&&d<45)jobDone(Math.round(job.reward*(.4+.6*clamp(c.hp/ctOf(c).hp,0,1))),'Clean delivery');break}
    case'race':if(d<45){job.i++;noise(.12,6000,.15);if(job.i>=job.pts.length){jobDone(job.reward);break}job.x=job.pts[job.i][0];job.y=job.pts[job.i][1];job.text=`Checkpoint ${job.i+1} of ${job.pts.length}. Any vehicle works.`}break;
    case'wrecker':job.text=`Destroy vehicles: ${job.n} of ${job.goal}.`;if(job.n>=job.goal)jobDone(job.reward);break;
    case'turf':job.text=job.gname==='Kings'?`Take out Low Palms Kings in the hood: ${job.n} of ${job.goal}.`:`Take out Vipers at the docks: ${job.n} of ${job.goal}.`;if(d<320)job.noMarker=true;if(job.n>=job.goal)jobDone(job.reward,job.gname==='Kings'?'The Kings will remember that':'The Vipers will remember that');break;
    case'wanted':job.text=`Lose the cops. ${Math.ceil(heat)} star${Math.ceil(heat)===1?'':'s'} left.`;if(heat<=0)jobDone(job.reward);break;
  }
}

// ---------- movement ----------
// stamina, jump, roof drops, hands up and horn
let stam=1,stamOut=false,stamIdle=0,handsUp=false,surrT=0,driftA=0,driftG=7,jvz=0,peak=0;
const floorH=()=>{const r=me.roof||roofAt(me.x,me.y);return Math.max(groundZ(me.x,me.y),r?r.H+1.6:0)};
const inAir=()=>jvz>0||me.z>floorH()+.01;
function jump(){if(state!=='play'||me.car||me.inside||me.climb||me.heli||me.jet||handsUp||inAir())return;jvz=230;stam=Math.max(0,stam-.12)}
function stamStep(sprint,dt){
  if(sprint){stam=Math.max(0,stam-dt/(6*gymMul()));stamIdle=0}
  else{stamIdle+=dt;if(stamIdle>.8)stam=Math.min(1,stam+dt/4*coffeeMul())}
  if(stam<=0)stamOut=true;
  if(stamOut&&stam>=.25)stamOut=false;
}
function footStep(dt){
  if(!inAir()||(jvz===0&&me.z-floorH()<=4)){jvz=0;peak=me.z=floorH();return} // a slope of up to 4 is walked, a ledge is a fall
  peak=Math.max(peak,me.z);
  jvz-=700*dt;me.z+=jvz*dt;
  const f=floorH();
  if(jvz<=0&&me.z<=f){const fall=peak-f;me.z=f;jvz=0;peak=f;me.roof=roofAt(me.x,me.y);if(fall>40)hurtMe((fall-40)*.9)}
}
function handsStep(dt){
  const cop=heat>0&&Math.ceil(heat)<=2&&cars.some(c=>c.kind==='police'&&Math.hypot(c.x-me.x,c.y-me.y)<220);
  if(!handsUp||!cop){surrT=0;return}
  if((surrT+=dt)>1.5){handsUp=false;surrT=0;feed('You gave yourself up');die('BUSTED',.05)}
}
function honk(){
  if(state!=='play')return;
  if(me.car){const c=me.car;hornSnd();
    for(const p of peds){if(p.down)continue;const dx=p.x-c.x,dy=p.y-c.y;if(Math.hypot(dx,dy)<200&&Math.abs(wrap(Math.atan2(dy,dx)-c.a))<.5){p.flee=1.2;p.fx=c.x;p.fy=c.y}}}
  else if(!me.heli&&!me.jet)handsUp=!handsUp;
}
if(DBG)Object.defineProperties(DBG,{stam:{get:()=>stam},handsUp:{get:()=>handsUp},driftA:{get:()=>driftA}});

// ---------- traffic lights ----------
// Four phases, shared worldwide, 15s cycle: 0 = axis A green (6s), 1 = axis A yellow (1.5s),
// 2 = axis B green (6s), 3 = axis B yellow (1.5s). Crossing roads alternate; the cross axis stays red.
// tlPaint is set by the 3D scene once the instanced lamps exist; it repaints all instances in one pass per phase change.
const TLD=[6,1.5,6,1.5];let tlT=0,tlP=-1,tlPaint=null;
function trafficStep(dt){
  if(!tlPaint)return;
  tlT+=dt;
  const c=TLD[0]+TLD[1]+TLD[2]+TLD[3],t=tlT%c,ph=t<TLD[0]?0:t<TLD[0]+TLD[1]?1:t<TLD[0]+TLD[1]+TLD[2]?2:3;
  if(ph!==tlP){tlP=ph;tlPaint(ph)}
}
if(DBG)Object.defineProperties(DBG,{tlP:{get:()=>tlP}});

// ---------- phone ----------
// T opens a phone over the game. The game keeps running and WASD still walks. World keys and shooting wait while it is open.
// Other features add an app with phoneApp(id,name,icon,render,colour) and send a text with phoneNotify(from,text,action).
let phoneOpen=false,phCam=false,phApp=null,phBat=100,phEyes=0,phIdle=90,phLiveT=0,phBanTm=0,phCallTm=0,phDown=false,phTabOn=null,phClk='',phBatS=-1,phBadge=-1,phDistr=null;
let waypoint=null,wpGroup=null,mapCur=null;
const apps={},notes=[],phLog=[],phHeld=[];
const mk=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const clk=()=>{const m=Math.floor(9*60+time)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
const starsNow=()=>Math.ceil(heat-.001),dnd=()=>starsNow()>=3;
const phFrame=$('phFrame'),phHome=$('phHome'),phAppEl=$('phApp'),phBody=$('phBody'),phTitle=$('phTitle'),phBan=$('phBan'),phTab=$('phTab'),phFade=$('phFade'),phWarn=$('phWarn'),phCallEl=$('phCall'),phCallName=$('phCallName');
const ICO=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC={map:'<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  contacts:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
  msg:'<path d="M4 5h16v11h-9l-5 4v-4H4z"/>',
  jobs:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12.5h18"/>',
  players:'<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.5 3.1-5.5 6.5-5.5s5.9 2 6.5 5.5"/><circle cx="17" cy="9" r="2.8"/><path d="M16.5 14.7c2.6.2 4.4 1.9 5 4.8"/>',
  places:'<path d="M3.5 20.5h17M5.5 20.5v-10l6.5-5 6.5 5v10M10 20.5v-5h4v5"/>',
  radio:'<rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="15.5" cy="14" r="2.5"/><path d="M7 12h4M7 16h3M8 8l9-4"/>',
  cam:'<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1"/>'};
function phoneApp(id,name,icon,render,col){apps[id]={name,icon:ICO(icon),render,col:col||'#ff3ea5'};phDrawHome()}
function phDrawHome(){phHome.replaceChildren();for(const id in apps){const a=apps[id],b=mk('button','ph-app');b.type='button';b.dataset.nav='';b.style.setProperty('--c',a.col);const ic=mk('span','ph-ic');ic.innerHTML=a.icon;a.bd=mk('b','ph-bd');a.bd.hidden=true;b.append(ic,mk('span','',a.name),a.bd);b.onclick=()=>phShow(id);phHome.append(b)}}
const phNavEls=()=>[...(phApp?phBody:phHome).querySelectorAll('[data-nav]:not(:disabled)')];
function phFocus(i){const els=phNavEls();if(els[i])els[i].focus({preventScroll:true})}
function phMove(dx,dy){const els=phNavEls();if(!els.length)return;let i=els.indexOf(document.activeElement);i=i<0?0:clamp(i+dx+dy*(phApp?1:4),0,els.length-1);els[i].focus({preventScroll:true});els[i].scrollIntoView({block:'nearest'})}
function phShow(id){const a=apps[id];if(!a)return;phApp=id;if(id==='map')mapCur={x:me.x,y:me.y};phHome.hidden=true;phAppEl.hidden=false;phTitle.textContent=a.name;phBody.replaceChildren();phPaint(a,true);phFocus(0)}
function phHomeShow(){phApp=null;phAppEl.hidden=true;phHome.hidden=false;phFocus(0)}
// re-renders into a detached copy and swaps only when the markup changed, so a tap is never lost to a repaint
function phPaint(a,force){const t=phBody.cloneNode(false);a.render(t);if(!force&&t.innerHTML===phBody.innerHTML)return;const was=phNavEls().indexOf(document.activeElement);phBody.replaceChildren(...t.childNodes);if(!force&&was>=0)phFocus(was)}
function phoneOpenNow(toMsg){
  if(phoneOpen||state!=='play')return;
  phoneOpen=true;for(const k in keys)if(!/^Key[WASD]$/.test(k))keys[k]=false;$('phone').classList.add('open');phBan.classList.remove('show');
  try{document.exitPointerLock&&document.exitPointerLock()}catch(_){}
  mouse.down=false;touchFire=false;
  phEyes=me.car&&Math.hypot(me.car.vx,me.car.vy)>200?2.5:0;
  if(toMsg)phShow('messages');else phHomeShow();
}
function phoneClose(){if(!phoneOpen)return;phoneOpen=false;phCam=false;document.body.classList.remove('phone-cam');phApp=null;$('phone').classList.remove('open');if(phFrame.contains(document.activeElement))document.activeElement.blur();phEyes=0}
function phCamOn(){phCam=true;document.body.classList.add('phone-cam');$('phone').classList.remove('open');if(phFrame.contains(document.activeElement))document.activeElement.blur()}
function phCamOff(){phCam=false;document.body.classList.remove('phone-cam');$('phone').classList.add('open');phHomeShow()}
function phSnap(){renderer.render(scene,camera);phFade.className='snap';setTimeout(()=>{phFade.className=''},120);
  cv.toBlob(b=>{if(!b)return;const u=URL.createObjectURL(b),a=mk('a');a.href=u;a.download=`palmetto-run-${Math.floor(time)}.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)},'image/png');feed('Photo saved')}
function phFadeTo(on){phFade.className=on?'on':''}
function phRing(){tone('triangle',mf(84),.16,.12);tone('triangle',mf(79),.22,.12,AC?AC.currentTime+.22:0)}
function phCallTo(name,f){if(phCallTm)return;phCallName.textContent=name;phCallEl.hidden=false;phRing();phCallTm=setTimeout(()=>{phCallTm=0;phCallEl.hidden=true;if(state==='play')f()},1200)}

// notifications: texts from contacts. Held while the cops are on you (3 stars or more), then delivered.
function phAdd(n){notes.unshift(n);if(notes.length>30)notes.length=30;if(!phoneOpen&&state==='play'){phBan.replaceChildren(mk('b','',n.from),mk('span','',n.text));phBan.classList.add('show');clearTimeout(phBanTm);phBanTm=setTimeout(()=>phBan.classList.remove('show'),4500)}}
function phoneNotify(from,text,action){const n={from,text,action:action||null,t:clk(),read:false};if(dnd()){phHeld.push(n);if(phHeld.length>30)phHeld.shift();return}phAdd(n)}
phBan.onclick=()=>{phBan.classList.remove('show');phoneOpenNow(true)};
// the log: everything feed() shows
function phLogAdd(t){phLog.unshift({t:clk(),text:t});if(phLog.length>30)phLog.length=30}
function acceptJob(){if(job&&job.phase!=='wait')return feed('You already have a job');newJob()}

// ---- contact actions
function phTaxi(){
  if(!waypoint)return phoneNotify('Taxi','Set a waypoint on the map first.');
  if(starsNow()>0)return phoneNotify('Taxi','No cab will pick you up with the cops on you.');
  if(me.heli||me.jet)return phoneNotify('Taxi','Not from up there.');
  if(!plPay(100))return;
  const wx=waypoint.x,wy=waypoint.y;waypoint=null;phoneClose();phFadeTo(true);
  setTimeout(()=>{const b=me.car||me;me.inside=null;me.roof=null;me.z=0;me.vx=me.vy=0;b.x=wx;b.y=wy;b.vx=b.vy=0;
    for(let i=0;i<3;i++)collide(b,b.x,b.y,me.car?14:8);me.x=b.x;me.y=b.y;phFadeTo(false)},reduced?0:1000);
}
function phLawyer(){const s=starsNow();if(s>=3)return phoneNotify('Lawyer','Not with three stars on you. Lose the cops first.');if(s<=0)return phoneNotify('Lawyer','You are clean. Keep your cash.');if(!plPay(1000*s))return;heat=0;coolT=0;jingle('pass');phoneNotify('Lawyer',`Done. ${s} star${s>1?'s':''} gone for ${money(1000*s)}.`)}
function phVic(){if(!unlocked('bank'))return phoneNotify('Vic',`Come back at level ${UNLOCK.bank}.`);phoneClose();openBrief()}
function phDealer(){waypoint={x:DEALER.x,y:DEALER.y};phoneNotify('Dealer','Pin is on your map. Come alone.')}
const CONTACTS=[['Taxi','Cab to your waypoint, $100',phTaxi],['Lawyer','Clears 1 or 2 stars, $1,000 each',phLawyer],['Vic','Heists',phVic],['Dealer','Sends you a pin',phDealer],['Mechanic','Cars',()=>phoneNotify('Mechanic','No cars on file yet.')]];

// ---- map: the city at full size, with the waypoint and a GPS line along the roads
const mapCv=mk('canvas','ph-map');mapCv.width=mapCv.height=560;
// GPS route along the road grid from the nearest intersection. Cached by the snapped start and the waypoint, so it is rebuilt only when either moves.
let wpRC=[],wpRK='';
function wpRouteC(x,y,wx,wy){const sn=v=>Math.round((v-60)/B)*B+60,ax=sn(x),ay=sn(y),k=ax+','+ay+','+wx+','+wy;
  if(k!==wpRK){wpRK=k;const p=[[ax,ay],[ax,sn(wy)],[wx,sn(wy)],[wx,wy]];wpRC=p.filter((q,i)=>!i||q[0]!==p[i-1][0]||q[1]!==p[i-1][1])}
  return wpRC}
function mapPick(p){if(waypoint&&Math.hypot(waypoint.x-p.x,waypoint.y-p.y)<130){waypoint=null;feed('Waypoint cleared')}else{waypoint={x:p.x,y:p.y};feed('Waypoint set')}}
mapCv.addEventListener('pointerdown',e=>{const r=mapCv.getBoundingClientRect(),k=W+500;mapCur={x:(e.clientX-r.left)/r.width*k-MO,y:(e.clientY-r.top)/r.height*k-MO};mapPick(mapCur)});
const PHSHORT={airport:'Airport',hood:'Low Palms',beach:'Beach',industrial:'Docks',suburb:'Heights',park:'Lagoon',downtown:'Downtown',midtown:'Midtown'};
function phDistricts(){const acc={};for(let i=0;i<N;i++)for(let j=0;j<N;j++){const k=district(i,j);if(!AREA[k])continue;const a=acc[k]||(acc[k]={x:0,y:0,n:0});a.x+=i*B+R+(B-R)/2;a.y+=j*B+R+(B-R)/2;a.n++}return Object.keys(acc).map(k=>({name:PHSHORT[k],x:acc[k].x/acc[k].n,y:acc[k].y/acc[k].n}))}
function phMapDraw(){
  const c=mapCv.getContext('2d'),S=560,k=S/(W+500),X=x=>(x+MO)*k,Y=y=>(y+MO)*k;
  c.setTransform(1,0,0,1,0,0);c.drawImage(miniBig,0,0,S,S);
  phDistr=phDistr||phDistricts();
  c.textAlign='center';c.textBaseline='middle';c.font='700 22px "Chakra Petch",sans-serif';
  for(const d of DOORS){c.fillStyle='#0b0814';c.beginPath();c.arc(X(d.x),Y(d.y),17,0,TAU);c.fill();c.strokeStyle=d.col;c.lineWidth=3;c.stroke();c.fillStyle=d.col;c.fillText(DOORICON[d.label]||'?',X(d.x),Y(d.y)+1)}
  c.font='700 30px "Chakra Petch",sans-serif';c.fillStyle='rgba(243,236,255,.9)';c.shadowColor='#0b0814';c.shadowBlur=10;
  for(const d of phDistr)c.fillText(d.name,X(d.x),Y(d.y));
  c.shadowBlur=0;
  for(const r of remotes.values()){if(r.dead)continue;c.fillStyle=r.color;c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(X(r.x),Y(r.y),11,0,TAU);c.fill();c.stroke()}
  if(job&&job.phase!=='wait'&&!job.noMarker){c.fillStyle=jobCol();c.beginPath();c.arc(X(job.x),Y(job.y),15,0,TAU);c.fill()}
  if(waypoint){const rt=wpRouteC(A.x,A.y,waypoint.x,waypoint.y);c.strokeStyle='#29e6d6';c.lineWidth=3;c.setLineDash([6,5]);c.beginPath();c.moveTo(X(A.x),Y(A.y));rt.forEach(([x,y])=>c.lineTo(X(x),Y(y)));c.stroke();c.setLineDash([]);
    c.fillStyle='#29e6d6';c.strokeStyle='#0b0814';c.lineWidth=3;c.beginPath();c.arc(X(waypoint.x),Y(waypoint.y),16,0,TAU);c.fill();c.stroke()}
  c.save();c.translate(X(me.x),Y(me.y));c.rotate(me.car?me.car.a:me.a);c.scale(1.9,1.9);c.fillStyle='#fff';c.strokeStyle='#0b0814';c.lineWidth=2;c.beginPath();c.moveTo(11,0);c.lineTo(-7,8);c.lineTo(-3,0);c.lineTo(-7,-8);c.closePath();c.fill();c.stroke();c.restore();
  if(mapCur){c.strokeStyle='#ffc94a';c.lineWidth=3;c.beginPath();c.arc(X(mapCur.x),Y(mapCur.y),20,0,TAU);c.stroke()}
}

// ---- 3D waypoint: the job beacon look in cyan
function wpBuild(){wpGroup=new THREE.Group();const cyl=new THREE.Mesh(new THREE.CylinderGeometry(15,15,160,24,1,true),new THREE.MeshBasicMaterial({color:'#29e6d6',transparent:true,opacity:.26,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  cyl.position.y=80;const ring=new THREE.Mesh(new THREE.RingGeometry(15,19,32),new THREE.MeshBasicMaterial({color:'#29e6d6',side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=1.8;wpGroup.add(cyl,ring);scene.add(wpGroup)}

// ---- apps
phoneApp('map','Map',IC.map,el=>{el.append(mapCv,mk('div','ph-sub','Click or press Enter to drop a pin. Click the pin again to clear it.'))},'#29e6d6');
phoneApp('contacts','Contacts',IC.contacts,el=>{for(const[n,r,f]of CONTACTS){const b=mk('button','ph-row');b.type='button';b.dataset.nav='';const g=mk('span','ph-grow');g.append(mk('b','',n),mk('span','ph-sub',r));b.append(mk('span','ph-av',n[0]),g,mk('span','ph-go','Call'));b.onclick=()=>phCallTo(n,f);el.append(b)}},'#ff3ea5');
phoneApp('messages','Messages',IC.msg,el=>{
  if(!notes.length&&!phLog.length)el.append(mk('div','ph-sub','No messages yet.'));
  for(const n of notes){const w=mk('div','ph-card');w.append(mk('div','ph-from',n.from),mk('div','ph-txt',n.text),mk('div','ph-tm',n.t));
    if(n.action){const b=mk('button','ph-btn',n.action.label);b.type='button';b.dataset.nav='';b.onclick=()=>{const f=n.action.fn;n.action=null;f();phPaint(apps.messages,true)};w.append(b)}
    n.read=true;el.append(w)}
  if(phLog.length){el.append(mk('div','ph-sec','Log'));for(const l of phLog)el.append(mk('div','ph-log',`${l.t}  ${l.text}`))}
},'#3dd68c');
phoneApp('jobs','Jobs',IC.jobs,el=>{const on=!!job&&job.phase!=='wait';
  const c=mk('div','ph-card');c.append(mk('b','ph-big',on?(job.title||'Mission'):'No job'),mk('div','ph-sub',on?job.text+(job.reward?` Pays ${money(job.reward)}.`:''):(job&&job.msg)||'Nothing on. The next one comes in a moment.'));
  const d=mk('button','ph-btn alt','Drop the job');d.type='button';d.dataset.nav='';d.disabled=!on;d.onclick=()=>jobFail('You dropped the job');
  const n=mk('button','ph-btn','Ask for a new job');n.type='button';n.dataset.nav='';n.disabled=on;n.onclick=()=>newJob();
  el.append(c,d,n)},'#ffc94a');
phoneApp('players','Players',IC.players,el=>{
  if(!remotes.size){el.append(mk('div','ph-sub',room?'Nobody else is in the city right now.':'Solo for now. Other players show up once the city is online.'));return}
  for(const[id,r]of remotes){const b=mk('button','ph-row');b.type='button';b.dataset.nav='';const g=mk('span','ph-grow');g.append(mk('b','',r.name),mk('span','ph-sub',`Lv ${r.lv} · ${Math.round(Math.hypot(r.x-me.x,r.y-me.y)/10)} m`));
    const dot=mk('i','ph-dot');dot.style.background=r.color;b.append(dot,g,mk('span','ph-go','GPS'));b.onclick=()=>{waypoint={x:r.x,y:r.y,peer:id};feed(`GPS on ${r.name}`)};el.append(b)}
},'#7b6bff');
phoneApp('places','Places',IC.places,el=>{const best={};for(const d of DOORS){const dd=Math.hypot(d.x-me.x,d.y-me.y),o=best[d.label];if(!o||dd<o.dd)best[d.label]={d,dd}}
  for(const[k,{d,dd}]of Object.entries(best).sort((a,b)=>a[1].dd-b[1].dd)){const b=mk('button','ph-row');b.type='button';b.dataset.nav='';const dt=mk('span','ph-dt',DOORICON[k]||'?');dt.style.color=d.col;
    b.append(dt,mk('span','ph-grow',k),mk('span','ph-sub',`${Math.round(dd/10)} m`),mk('span','ph-go','GPS'));b.onclick=()=>{waypoint={x:d.x,y:d.y};feed(`GPS set to ${k}`)};el.append(b)}
},'#ff6b3d');
phoneApp('radio','Radio',IC.radio,el=>{const b=mk('button','ph-btn','Next station');b.type='button';b.dataset.nav='';b.onclick=()=>cycleRadio();
  el.append(mk('div','ph-big',RADIO[radio]),mk('div','ph-sub',radio?'Playing now':'The radio is off'),b)},'#4aa3ff');
phoneApp('camera','Camera',IC.cam,el=>{const b=mk('button','ph-btn','Open the camera');b.type='button';b.dataset.nav='';b.onclick=phCamOn;
  el.append(mk('div','ph-sub','The phone and the HUD hide. Enter takes the shot, Escape comes back.'),b)},'#9d97ad');
phoneApp('settings','Settings',IC.gear,el=>{const b=mk('button','ph-btn','Open settings');b.type='button';b.dataset.nav='';b.onclick=()=>{phoneClose();openSettings()};
  el.append(mk('div','ph-sub','Sensitivity, invert Y and aim assist.'),b)},'#5a5570');

// ---- keys while the phone is open
function phoneKey(e){
  const c=e.code,rep=e.repeat;
  if(phCam){if(c==='Enter'&&!rep)phSnap();else if(c==='Escape')phCamOff();return}
  if(c==='Escape'||(c==='KeyT'&&!rep)){phoneClose();return}
  if(/^Arrow/.test(c)){e.preventDefault();const dx=c==='ArrowLeft'?-1:c==='ArrowRight'?1:0,dy=c==='ArrowUp'?-1:c==='ArrowDown'?1:0;
    if(phApp==='map'&&mapCur){mapCur.x=clamp(mapCur.x+dx*70,-MO,W+400);mapCur.y=clamp(mapCur.y+dy*70,-MO,W+400)}else phMove(dx,dy);return}
  if(c==='Enter'){e.preventDefault();if(rep)return;if(phApp==='map'&&mapCur)mapPick(mapCur);else{const el=document.activeElement;if(el&&el.matches&&el.matches('[data-nav]'))el.click()}return}
  if(c==='Backspace'){e.preventDefault();if(phApp)phHomeShow()}
}
$('phBack').onclick=phHomeShow;$('phTab').onclick=()=>phoneOpenNow(false);
phFrame.addEventListener('pointerdown',()=>{phDown=true});
addEventListener('pointerup',()=>{phDown=false});addEventListener('pointercancel',()=>{phDown=false});

// ---- per frame (called from ui)
function phoneStep(dt){
  phBat=Math.max(3,phBat-dt/20);
  if(phoneOpen&&state!=='play')phoneClose();
  if(state!=='play')phBan.classList.remove('show');
  if(!dnd()&&phHeld.length)while(phHeld.length)phAdd(phHeld.shift());
  if(state==='play'&&!phoneOpen&&(!job||job.phase==='wait')&&!starsNow()&&!me.inside){phIdle-=dt;if(phIdle<=0){phIdle=70+rand()*50;phoneNotify('Vic','Got a job for you.',{label:'Accept',fn:acceptJob})}}
  if(waypoint&&waypoint.peer){const r=remotes.get(waypoint.peer);if(r){waypoint.x=r.x;waypoint.y=r.y}else{waypoint=null;feed('Lost sight of them. Waypoint cleared')}}
  if(waypoint&&Math.hypot(waypoint.x-A.x,waypoint.y-A.y)<40){waypoint=null;feed('Waypoint reached')}
  if(waypoint&&!wpGroup)wpBuild();
  if(wpGroup){wpGroup.visible=!!waypoint&&state==='play'&&!me.inside;if(waypoint)wpGroup.position.set(waypoint.x,groundZ(waypoint.x,waypoint.y),waypoint.y)}
  if(phEyes>0)phEyes-=dt;
  phWarn.hidden=!(phoneOpen&&phEyes>0);
  const tabOn=state==='play'&&!phoneOpen;if(tabOn!==phTabOn){phTabOn=tabOn;phTab.hidden=!tabOn}
  if(phoneOpen&&phApp==='map')phMapDraw();
  if(phoneOpen&&phApp&&phApp!=='map'&&!phDown&&(phLiveT-=dt)<=0){phLiveT=.5;phPaint(apps[phApp])}
  const cs=clk(),bs=Math.round(phBat);
  if(cs!==phClk){phClk=cs;$('phClock').textContent=cs;$('phDnd').hidden=!dnd()}
  if(bs!==phBatS){phBatS=bs;$('phBatF').style.width=bs+'%'}
  const u=notes.filter(n=>!n.read).length;
  if(u!==phBadge){phBadge=u;apps.messages.bd.textContent=u;apps.messages.bd.hidden=!u;$('phTabN').textContent=u;$('phTabN').hidden=!u}
}
if(DBG)Object.defineProperties(DBG,{phoneOpen:{get:()=>phoneOpen},waypoint:{get:()=>waypoint},phoneNotify:{get:()=>phoneNotify},phoneApps:{get:()=>Object.keys(apps)}});

// ---------- perf ----------
// Frame cost for ?perf (overlay) and F3. The boot loop passes ms for update() and ui(); render() sets pf.gl around renderer.render.
const pf={on:/[?&]perf\b/.test(location.search),gl:0,n:0,s:{fr:0,up:0,mi:0,ui:0,gl:0},avg:{fps:0,fr:0,up:0,mi:0,ui:0,gl:0,calls:0,tris:0,geo:0,tex:0,heap:0},el:$('perf')};
pf.el.hidden=!pf.on;
function perfFrame(fr,up,mi,ui){const s=pf.s;s.fr+=fr;s.up+=up;s.mi+=mi;s.ui+=ui;s.gl+=pf.gl;if(++pf.n<60)return;
  const a=pf.avg,ri=renderer.info;for(const k in s){a[k]=s[k]/pf.n;s[k]=0}pf.n=0;
  a.fps=1000/a.fr;a.calls=ri.render.calls;a.tris=ri.render.triangles;a.geo=ri.memory.geometries;a.tex=ri.memory.textures;a.heap=performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):0;
  if(!pf.el.hidden)pf.el.textContent=`${a.fps.toFixed(0)} fps  ${a.fr.toFixed(1)} ms\nupdate ${a.up.toFixed(2)}  gl ${a.gl.toFixed(2)}  ui ${a.ui.toFixed(2)}  mini ${a.mi.toFixed(2)}\ncalls ${a.calls}  tris ${(a.tris/1000).toFixed(0)}k  geo ${a.geo}  tex ${a.tex}  heap ${a.heap} MB`}
addEventListener('keydown',e=>{if(e.code==='F3'){e.preventDefault();pf.el.hidden=!pf.el.hidden}});
if(DBG)Object.defineProperties(DBG,{perf:{get:()=>pf.avg}});

// ---------- input ----------
const isTouch=matchMedia('(pointer:coarse)').matches;
const keys={};let mouse={x:0,y:0,t:-99,down:false},stick={id:null,ox:0,oy:0,x:0,y:0},touchFire=false;
const typing=()=>document.activeElement&&document.activeElement.tagName==='INPUT';
addEventListener('keydown',e=>{if(e.code==='Escape'&&state==='shop')closeShop();if(typing())return;
  if(phoneOpen&&!/^Key[WASD]$/.test(e.code)){phoneKey(e);return}keys[e.code]=true;
  if(state==='menu'||state==='shop')return;
  if(phoneOpen){phoneKey(e);return}
  if(e.code==='KeyT'&&!e.repeat&&state==='play'){phoneOpenNow(false);return}
  if(e.code==='Escape'&&lap){endLap();return}
  if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.code==='KeyE'||e.code==='KeyF'){if(!e.repeat)toggleCar()}
  if(e.code==='KeyC'&&!e.repeat)jump();
  if(e.code==='KeyH'&&!e.repeat)honk();
  if(e.code==='KeyV'&&!e.repeat)nitroTap();
  if(e.code==='KeyM'&&!e.repeat)muted=!muted;
  if(e.code==='KeyK'&&!e.repeat)cycleRadio();
  if(/^Digit[1-8]$/.test(e.code))equip(WEAPONS[+e.code.slice(5)-1].id);
  if(e.code==='KeyR'&&!e.repeat)cycleWeapon();
  if(e.code==='KeyP'&&!e.repeat&&state==='play')openSettings();
  if(e.code==='Tab'&&!e.repeat)openWheel();
  if(e.code==='KeyG'&&!e.repeat)detonate();
  if(e.code==='KeyX'&&!e.repeat)dropFlares();
  if(e.code==='KeyN'&&!e.repeat)usePowder();
  if(e.code==='KeyZ'&&!e.repeat&&weap==='sniper'&&!me.car)scoped=!scoped;
});
addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Tab')closeWheel(true)});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;mouse.down=false;touchFire=false;closeWheel(false)});
const look={yaw:-Math.PI/2,pitch:.2,id:null,lx:0,ly:0,off:0,offT:-9};let lastFireT=-9;
let settings={sens:1,inv:false,assist:8},qLock=null;
function saveSettings(){try{localStorage.setItem('pr-settings',JSON.stringify(settings))}catch(_){}}
function openSettings(){$('setSens').value=settings.sens;$('setInv').checked=settings.inv;$('setAssist').value=String(settings.assist);openModal('settings')}
$('setSens').addEventListener('input',e=>{settings.sens=+e.target.value;saveSettings()});
$('setInv').addEventListener('change',e=>{settings.inv=e.target.checked;saveSettings()});
$('setAssist').addEventListener('change',e=>{settings.assist=+e.target.value;saveSettings()});
// lock-on aim assist: hold Q on foot. Turns look.yaw toward one target; the lock holds while the target lives and stays within 700 units.
function aimAssist(dt){
  if(!(keys.KeyQ&&settings.assist>0&&state==='play'&&!me.car&&!me.heli&&!me.jet&&!me.inside)){qLock=null;return}
  const groups=[peds.filter(p=>p.gang&&!p.down),[...remotes.values()].filter(r=>!r.dead&&!r.inCar&&!r.inHeli&&!r.inJet),cars.filter(c=>c.kind==='police'&&heat>0),peds.filter(p=>!p.gang&&!p.down)];
  const dist=o=>Math.hypot(o.x-me.x,o.y-me.y);
  let t=null;
  if(qLock&&groups.some(g=>g.includes(qLock))&&dist(qLock)<=700)t=qLock;
  if(!t)for(const g of groups){let bd=600;for(const o of g){const d=dist(o);if(d<bd&&Math.abs(wrap(Math.atan2(o.y-me.y,o.x-me.x)-look.yaw))<=.6){bd=d;t=o}}if(t)break}
  qLock=t;
  if(t)look.yaw+=clamp(wrap(Math.atan2(t.y-me.y,t.x-me.x)-look.yaw),-settings.assist*dt,settings.assist*dt);
}
function turn(dx,dy){dx*=settings.sens;dy*=settings.sens;if(settings.inv)dy=-dy;if(wheelOpen){wheelVec.x+=dx;wheelVec.y+=dy;const l=Math.hypot(wheelVec.x,wheelVec.y);if(l>120){wheelVec.x*=120/l;wheelVec.y*=120/l}if(l>25){const n=WEAPONS.length,i=((Math.round((Math.atan2(wheelVec.y,wheelVec.x)+Math.PI/2)/(TAU/n))%n)+n)%n;if(WEAPONS[i].id!==wheelSel){wheelSel=WEAPONS[i].id;paintWheel()}}return}if(me.car){look.off=clamp(look.off+dx*.0026,-2.6,2.6);look.offT=time}else look.yaw+=dx*.0026*(scoped?.3:1);look.pitch=clamp(look.pitch+dy*.0022*(scoped?.3:1),-.45,1.3)}
function lockMouse(){if(isTouch||phoneOpen||document.pointerLockElement===cv)return;try{const p=cv.requestPointerLock();if(p&&p.catch)p.catch(()=>{})}catch(_){}}
cv.addEventListener('pointerdown',e=>{
  if(state==='menu')return;audioInit();
  if(e.pointerType==='mouse'){if(document.pointerLockElement!==cv){lockMouse();return}if(e.button===0)mouse.down=true;if(e.button===2&&weap==='sniper'&&!me.car)scoped=true;return}
  if(stick.id===null&&e.clientX<VW*.45){stick={id:e.pointerId,ox:e.clientX,oy:e.clientY,x:0,y:0};try{cv.setPointerCapture(e.pointerId)}catch(_){}}
  else if(look.id===null){look.id=e.pointerId;look.lx=e.clientX;look.ly=e.clientY;try{cv.setPointerCapture(e.pointerId)}catch(_){}}
});
cv.addEventListener('contextmenu',e=>e.preventDefault());
let wheelAt=0;
cv.addEventListener('wheel',e=>{e.preventDefault();const dy=e.deltaMode===1?e.deltaY*40:e.deltaY;if(state!=='play'||wheelOpen||Math.abs(dy)<=4||performance.now()-wheelAt<180)return;wheelAt=performance.now();if(dy>0)cycleWeapon();else prevWeapon()},{passive:false});
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
$('bCar').addEventListener('pointerdown',e=>{e.preventDefault();toggleCar()});
let gunHold=null,gunHeld=false;
$('bGun').addEventListener('pointerdown',e=>{e.preventDefault();gunHeld=false;clearTimeout(gunHold);gunHold=setTimeout(()=>{gunHeld=true;openWheel()},280)});
for(const[id,set]of[['bUp',v=>heliUpT=v],['bDn',v=>heliDnT=v]]){$(id).addEventListener('pointerdown',e=>{e.preventDefault();set(true)});for(const t of['pointerup','pointercancel','pointerleave'])$(id).addEventListener(t,()=>set(false))}
$('bNose').addEventListener('pointerdown',e=>{e.preventDefault();usePowder()});
$('bFlare').addEventListener('pointerdown',e=>{e.preventDefault();dropFlares()});
$('bBoom').addEventListener('pointerdown',e=>{e.preventDefault();detonate()});
$('bAim').addEventListener('pointerdown',e=>{e.preventDefault();if(weap==='sniper'&&!me.car)scoped=!scoped});
$('bGun').addEventListener('pointerup',()=>{clearTimeout(gunHold);if(!gunHeld)cycleWeapon()});
if(DBG)Object.defineProperties(DBG,{qLock:{get:()=>qLock},settings:{get:()=>settings}});

// ---------- multiplayer (room presence) ----------
let room=null,myPeer=null,netState='connecting',netWhy='';
const PV=1; // presence protocol version, bump when the presence shape changes
const killXpT={},pvWarn=new Set();
// The city comes from the URL: ?room=code, else the last code used on this device, else the
// public city. A room is 1 to 10 lowercase letters and digits; anything else is invalid.
function roomFrom(u){try{const v=new URL(u,'http://x').searchParams.get('room');return v&&/^[a-z0-9]{1,10}$/.test(v.toLowerCase())?v.toLowerCase():'main'}catch(e){return 'main'}}
const loadRoom=()=>{try{const s=(localStorage.getItem('pr-room')||'').toLowerCase();return /^[a-z0-9]{1,10}$/.test(s)?s:'main'}catch(e){return 'main'}};
const saveRoom=r=>{try{localStorage.setItem('pr-room',r)}catch(e){}};
const inClaude=!!(window.claude&&typeof window.claude.use==='function');
let roomName=/[?&]room=/.test(location.search)?roomFrom(location.search):loadRoom();
const roomTag=inClaude||roomName==='main'?'':' \u00b7 '+roomName.toUpperCase();
saveRoom(roomName);
// Outside Claude (e.g. the Cloudflare site) the game joins the lobby over a WebSocket at
// /ws?room=<room> (see worker/index.js). This object mimics the parts of Claude's room API the game uses.
function wsRoom(url){
  let ws=null,mine={},self=null,snap=Object.freeze([]),dirty=false;const others=new Map(),subs=[];
  const rebuild=()=>{const list=[];if(self)list.push({peer:self,sameTab:true,isMe:true,kind:'viewer',guest:false,presence:mine});
    for(const[peer,d]of others)list.push({peer,sameTab:false,isMe:false,kind:'viewer',guest:false,presence:d});
    snap=Object.freeze(list);for(const f of subs)try{f({peers:snap,joined:[],left:[],updated:[]})}catch(e){}};
  const send=()=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify({t:'p',d:mine}))};
  const connect=()=>{
    try{ws=new WebSocket(url)}catch(e){setTimeout(connect,3000);return}
    ws.onopen=()=>{netState='online';netWhy='';send()};
    ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(_){return}if(!m||typeof m!=='object')return;
      if(m.t==='hello'){self=String(m.peer).slice(0,40);others.clear();for(const q of Array.isArray(m.peers)?m.peers:[])if(q&&q.peer&&q.d&&typeof q.d==='object')others.set(String(q.peer).slice(0,40),q.d);rebuild()}
      else if(m.t==='p'&&m.peer&&m.d&&typeof m.d==='object'){others.set(String(m.peer).slice(0,40),m.d);dirty=true}
      else if(m.t==='leave'&&m.peer){others.delete(String(m.peer));rebuild()}};
    ws.onclose=()=>{self=null;others.clear();rebuild();if(netState==='online'){netState='connecting';netWhy=''}setTimeout(connect,3000)};
    ws.onerror=()=>{netState='solo';netWhy='server offline'}};
  connect();setInterval(()=>{if(dirty){dirty=false;rebuild()}},50);
  return{peers:()=>snap,onPeers(f){subs.push(f);return()=>{}},presence(patch){for(const k in patch){if(patch[k]===null)delete mine[k];else mine[k]=patch[k]}send();return Promise.resolve()}}}
const lobbyHost=/^https?:$/.test(location.protocol)&&!(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&location.port!=='8787');
const remotes=new Map();
const num=(v,d=0)=>Number.isFinite(v)?v:d;
const hex=(v,d='#ff3ea5')=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v)?v:d;
const str=v=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e]/g,'').slice(0,16):'';
(async()=>{
  try{
    if(!window.claude||typeof window.claude.use!=='function'){if(lobbyHost){room=wsRoom((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws?room='+roomName);room.onPeers(ch=>{for(const p of ch.peers)if(p.sameTab)myPeer=p.peer})}else{netState='solo';netWhy='no-viewer'}return}
    room=await window.claude.use('room');
    if(!room){netState='solo';netWhy='not-admitted';return}
    netState='online';
    room.onPeers(ch=>{for(const p of ch.peers)if(p.sameTab)myPeer=p.peer},e=>{netState='solo';netWhy=(e&&e.code)||'error';room=null});
  }catch(e){netState='solo';netWhy='error';room=null}
})();
setTimeout(()=>{if(netState==='connecting'){netState='solo';netWhy='timeout'}},12000);
function syncRoom(dt){
  if(!room)return;
  let ps;try{ps=room.peers()}catch(e){return}
  const seen=new Set();
  for(const p of ps){
    if(p.sameTab){myPeer=p.peer;continue}
    if(p.kind!=='viewer')continue;
    const s=p.presence||{};if(!Number.isFinite(s.x)||!Number.isFinite(s.y))continue;
    seen.add(p.peer);
    const pv=num(s.pv)||0;if(pv!==PV&&!pvWarn.has(p.peer)){pvWarn.add(p.peer);feed('Someone is on a different game version. Ask them to reload the page')}
    let r=remotes.get(p.peer);
    if(!r){r={x:s.x,y:s.y,a:num(s.a),shot:Array.isArray(s.s)?s.s[0]:null,ex:Array.isArray(s.ex)?s.ex[0]:null,fl:s.fl,dmgSeen:null,kMe:null};remotes.set(p.peer,r);feed(`${str(s.n)||'A driver'} rolled into town`)}
    r.tx=clamp(s.x,-50,W+4500);r.ty=clamp(s.y,HILL.edge,W+300);r.ta=num(s.a);r.name=str(s.n)||'Driver';r.color=hex(s.c);r.inCar=s.v===1;r.inHeli=s.v===2;r.inJet=s.v===3;r.cc=hex(s.cc,r.color);r.ng=hex(s.ng,null);r.z=clamp(num(s.z),0,900);r.cz=clamp(num(s.cz),-50,900);r.ct=hasCT(s.ct)?s.ct:'sedan';r.hp=clamp(num(s.h,100),0,100);r.dead=s.dd===1;r.w=clamp(num(s.w),0,5);r.lv=clamp(Math.floor(num(s.lv,1)),1,30);r.lk=str(s.lk);r.ar=Array.isArray(s.ar)?[clamp(num(s.ar[0]),0,99999),clamp(num(s.ar[1]),0,99999)]:[0,0];
    r.k=s.k&&typeof s.k==='object'?s.k:{};
    r.rk=rkParse(s.rk);
    if(myPeer){
      const dv=s.d&&typeof s.d==='object'?num(s.d[myPeer]):0;
      if(r.dmgSeen===null)r.dmgSeen=dv;else if(dv>r.dmgSeen){const amt=Math.min(dv-r.dmgSeen,120);r.dmgSeen=dv;if(me.jet){me.jet.hp-=amt*BAL.remote.air;me.lastHitBy=p.peer;me.lastHitT=time}else if(me.heli){me.heli.hp-=amt*BAL.remote.air;me.lastHitBy=p.peer;me.lastHitT=time}else if(me.car){const arm=me.car.type==='armored';damageCar(me.car,amt*(arm?BAL.remote.arm:BAL.remote.car),false);if(arm){me.lastHitBy=p.peer;me.lastHitT=time}else hurtMe(amt*BAL.remote.occ,p.peer)}else hurtMe(amt,p.peer)}else r.dmgSeen=dv;
      const km=num(r.k[myPeer]);if(r.kMe===null)r.kMe=km;else if(km>r.kMe){r.kMe=km;feed(`You wasted ${r.name}`);me.cash+=50;if(time-(killXpT[p.peer]||-99)>60){killXpT[p.peer]=time;gainXP(50,'Takedown')}}
    }
    if(s.fl!==r.fl){r.fl=s.fl;r.flareT=time;for(let i=0;i<14;i++){const a=rand()*TAU,sp=60+rand()*140;parts.push({x:r.x,y:r.y,z0:(r.inCar?r.cz||0:r.z||0)+6,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:2.4,max:2.4,col:'#ffd27a',k:'flare',sz:3})}}
    r.hs=Array.isArray(s.hs)&&s.hs.length===4&&s.hs.every(Number.isFinite)?s.hs:null;
    r.sb=Array.isArray(s.sb)?s.sb.slice(0,5).filter(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite)):[];
    if(Array.isArray(s.ex)&&s.ex[0]!==r.ex){r.ex=s.ex[0];for(let i=1;i+1<s.ex.length&&i<12;i+=2)if(Number.isFinite(s.ex[i])&&Number.isFinite(s.ex[i+1]))explode(s.ex[i],s.ex[i+1],false,true)}
    if(Array.isArray(s.s)&&s.s[0]!==r.shot){r.shot=s.s[0];r.shotT=time;if(Number.isFinite(s.s[1])&&Number.isFinite(s.s[2])&&Number.isFinite(s.s[3])){const w=WEAPONS[num(s.s[4])|0]||WEAPONS[0];fireZ=clamp(num(s.s[6],12),0,920);fireSlope=clamp(num(s.s[7]),-3,3);fireSpd=w.speed||0;fireLife=w.life||0;if(!w.throw)for(let i=0;i<w.pellets;i++)fire(s.s[1],s.s[2],s.s[3]+rr(-w.spread,w.spread),'remote',0,w.rocket,i>0,w.homing&&typeof s.s[5]==='string'?{peer:s.s[5].slice(0,40)}:null,w.id)}}
  }
  for(const k of[...remotes.keys()])if(!seen.has(k)){feed(`${remotes.get(k).name} left`);remotes.delete(k);pvWarn.delete(k)}
  fireZ=12;fireSpd=0;fireLife=0;fireSlope=0;
  const f=1-Math.exp(-dt*12);
  for(const r of remotes.values()){if(Math.hypot(r.tx-r.x,r.ty-r.y)>300){r.x=r.tx;r.y=r.ty}else{r.x+=(r.tx-r.x)*f;r.y+=(r.ty-r.y)*f}r.a+=wrap(r.ta-r.a)*f}
}
let pubT=0,pruneT=0;
function publish(dt){
  if(!room||state==='menu')return;
  pubT+=dt;pruneT+=dt;
  if(pruneT>3){pruneT=0;for(const m of[dmgOut,killedBy])for(const k of Object.keys(m))if(!remotes.has(k))delete m[k]}
  if(pubT<.066)return;pubT=0;
  const c=me.car,x=c?c.x:me.x,y=c?c.y:me.y,a=c?c.a:me.a;
  room.presence({lk:lookCode(look3),ar:[arc.hi[0],arc.hi[1]],n:myName,c:myColor,x:Math.round(x),y:Math.round(y),a:Math.round(a*100)/100,v:me.jet?3:me.heli?2:c?1:0,fl:flareSeq,hs:heist.on?[heist.seed,heist.bits,Math.round(heist.drill),heist.drilling?1:0]:null,cc:c?c.color:myColor,ng:c&&c.mods&&c.mods.neon||null,ct:c?c.type:'sedan',h:Math.round(clamp(me.hp,0,100)),z:Math.round(me.car?0:me.z||0),cz:Math.round(me.car?me.car.z||0:0),dd:state==='play'?0:1,d:dmgOut,k:killedBy,s:lastShot,sb:stickies.map(b=>[Math.round(b.x),Math.round(b.y),Math.round(b.z)]),ex:lastEx,w:Math.ceil(heat),lv,rk:rkMine(),pv:PV}).catch(()=>{});
}
function killsOf(peer){let k=0;for(const r of remotes.values())k+=num(r.k[peer]);if(peer!==myPeer)k+=num(killedBy[peer]);return k}
if(DBG)Object.defineProperties(DBG,{pv:{get:()=>PV}});
if(DBG)Object.defineProperties(DBG,{room:{get:()=>roomName},roomFrom:{get:()=>roomFrom}});

// ---------- ui ----------
function feed(t){const d=document.createElement('div');d.textContent=t;$('feed').appendChild(d);setTimeout(()=>d.remove(),5000);while($('feed').children.length>5)$('feed').firstChild.remove();phLogAdd(t)}
let bigT=0;
function showBig(t,col,s,dur){const b=$('big');b.hidden=false;b.querySelector('.t').textContent=t;b.querySelector('.t').style.color=col;b.querySelector('.t').style.textShadow=`0 0 24px ${col}`;b.querySelector('.s').textContent=s||'';bigT=dur||0}
function hideBig(){$('big').hidden=true;bigT=0}
let uiT=0,saveT=0;
function ui(dt){phoneStep(dt);
  if(bigT>0){bigT-=dt;if(bigT<=0)hideBig()}
  uiT+=dt;if(uiT<.1)return;uiT=0;
  $('cash').textContent='$'+me.cash.toLocaleString('en-US');
  lvlBar();
  const st=Math.ceil(heat-.001);$('stars').innerHTML='<b>'+'★'.repeat(st)+'</b>'+'★'.repeat(5-st);
  $('stars').style.opacity=heat>0&&unseenT>4&&Math.floor(time/.3)%2?.3:1;
  $('hp').style.width=clamp(me.hp,0,100)+'%';$('hp').style.background=me.hp<35?'var(--danger)':'var(--cyan)';
  $('stamBar').hidden=stam>=1;$('stam').style.width=stam*100+'%';
  {const w=WEAPONS[WI[weap]],el=$('weapon');el.firstChild.nodeValue=me.jet?'Jet missiles':me.heli?'Heli rockets':w.name;el.querySelector('span').textContent=me.jet||me.heli||w.id==='pistol'?'\u221e':String(ammo[w.id]||0)}
  {const nb=$('netb'),on=netState==='online',cls=on?'on':netState==='solo'?'off':'',t=on?`\u25cf Online \u00b7 ${remotes.size+1} in city${roomTag}`:netState==='solo'?'Solo \u00b7 '+(netWhy||'not connected'):'Connecting';if(nb.textContent!==t)nb.textContent=t;if(nb.className!==cls)nb.className=cls}
  if(state==='shop')$('shopCash').textContent='$'+me.cash.toLocaleString('en-US');
  if((saveT+=.1)>3){saveT=0;saveArsenal()}
  {const lk=$('lock');lk.hidden=!lockTarget;if(lockTarget)lk.textContent='Locked: '+lockTarget.name;let inc=false;if(myPeer&&state==='play')for(const b of bullets)if(b.owner==='remote'&&b.home&&b.home.peer===myPeer){inc=true;break}$('warn').hidden=!inc}
  {const dk=$('drunk');dk.hidden=drunk<=0;if(drunk>0)dk.textContent='Drunk '+'●'.repeat(Math.max(1,Math.ceil(drunk/12)));cv.style.filter=((drunk>3?`blur(${Math.min(2.2,drunk/20).toFixed(2)}px) saturate(${(1+Math.min(.8,drunk/40)).toFixed(2)})`:'')+(power>0?' contrast(1.2) saturate(1.6) brightness(1.08)':crashT>0?' grayscale(.6) blur(1px)':'')).trim()}
  {const pw=$('power');pw.hidden=!(power>0||crashT>0||powder>0);pw.textContent=power>0?`Super strength ${Math.ceil(power)}s`:crashT>0?`Crashing ${Math.ceil(crashT)}s`:`White powder x${powder} (${isTouch?'BUMP':'N'})`;if(isTouch)$('bNose').hidden=!(powder>0&&!power)}
  if(isTouch){$('bBoom').hidden=!stickies.length;$('bAim').hidden=!(weap==='sniper'&&!me.car)}
  $('scope').hidden=!scoped;
  {const lm=$('lockMark');if(!qLock)lm.hidden=true;else{const v=new THREE.Vector3(qLock.x,(qLock.z||0)+14,qLock.y).project(camera);lm.hidden=v.z>1||Math.abs(v.x)>1||Math.abs(v.y)>1;lm.style.left=(v.x+1)*50+'%';lm.style.top=(1-v.y)*50+'%'}}
  {const bi=clamp(Math.floor(A.x/B),0,N-1),bj=clamp(Math.floor(A.y/B),0,N-1),dn=me.inside?null:(landmarkKey(A.x,A.y)||(A.y<0?'hills':A.y>W?'beach':district(bi,bj)));if(dn!==ui.area){ui.area=dn;const el=$('area');if(dn){el.replaceChildren();const sm=document.createElement('small');sm.textContent=AREA[dn][1];el.append(document.createTextNode(AREA[dn][0]),sm);el.style.opacity=1;clearTimeout(ui.areaT);ui.areaT=setTimeout(()=>el.style.opacity=0,3500)}}}
  $('carhp').textContent=me.jet?`Fighter jet ${Math.max(0,Math.round(me.jet.hp/BAL.jetHp*100))}% · ${Math.round(me.jet.speed*.6)} km/h · ${Math.round((me.jet.z-heliGround(me.jet.x,me.jet.y))/10)} m up`:me.heli?`Attack helicopter ${Math.max(0,Math.round(me.heli.hp/BAL.heliHp*100))}% · ${Math.round((me.heli.z-heliGround(me.heli.x,me.heli.y))/10)} m up`:me.car?(me.car.burn?'Car on fire! Get out (E)':`${ctOf(me.car).name} ${Math.max(0,Math.round(me.car.hp/ctOf(me.car).hp*100))}%`):'';
  const j=$('job');j.replaceChildren();{const jt=document.createElement('strong'),jx=document.createElement('span');
    if(!job||job.phase==='wait'){jt.textContent='Missions';jx.textContent=job&&job.msg?job.msg:'Waiting for the next job...'}
    else{jt.textContent=job.title||'Mission';jx.textContent=job.text+(job.timed?` ${Math.max(0,Math.ceil(job.t))}s left.`:'')+(job.reward?` $${job.reward}`:'')}
    jt.style.color=job&&job.col||'';j.style.borderLeftColor=job&&job.col||'';j.append(jt,jx)}
  if(job&&job.phase!=='wait'&&!job.noMarker&&!me.inside){const px=me.car?me.car.x:me.x,py=me.car?me.car.y:me.y,dd=document.createElement('div');dd.style.cssText='color:var(--gold);font-weight:700;margin-top:2px';dd.textContent=Math.round(Math.hypot(job.x-px,job.y-py)/10)+' m away';j.appendChild(dd)}
  // players
  const pl=$('players');
  if(room){
    const rows=[{name:myName+' (you)',color:myColor,k:myPeer?killsOf(myPeer):0,lv}];
    for(const[peer,r]of remotes)rows.push({name:r.name,color:r.color,k:killsOf(peer),lv:r.lv});
    rows.sort((a,b)=>b.k-a.k);
    pl.hidden=false;pl.replaceChildren();
    const h=document.createElement('div');h.className='h';h.textContent=`In the city · ${rows.length}`;pl.appendChild(h);
    for(const r of rows){const d=document.createElement('div');d.className='row';const n=document.createElement('span');const dot=document.createElement('i');dot.className='dot';dot.style.background=r.color;n.appendChild(dot);n.appendChild(document.createTextNode(r.name+' Lv '+r.lv));const k=document.createElement('span');k.className='k';k.textContent=r.k+' KO';d.append(n,k);pl.appendChild(d)}
  }else pl.hidden=true;
  // hint
  const h=$('hint');let t='';
  if(state==='play'){if(me.car){const sp=Math.hypot(me.car.vx,me.car.vy);if(me.car.burn)t=isTouch?'Tap CAR to bail out':'E — bail out!';else if(sp<60)t=isTouch?'Tap CAR to get out':'E — get out'}
    else if(me.inside){const p=nearSpot();t=p?(isTouch?'Tap CAR: ':'E: ')+p.label:''}
    else if(nearLadder()){t=(isTouch?'Tap CAR: ':'E: ')+(nearLadder().up?'Climb the ladder':'Climb down')}
    else if(me.roof){t=''}
    else if(nearDealer()){t=(isTouch?'Tap CAR: ':'E: ')+'Buy a bag of white powder ($200)'}
    else{const c=nearestCar();if(c)t=(isTouch?'Tap CAR — ':'E — ')+(c.kind==='traffic'?'jack this car':c.kind==='police'?'steal the cruiser':'take this car');else{const q=talkTarget();if(q)t=(isTouch?'Tap CAR: ':'E: ')+(robbing(q)?'rob':'talk')}}}
  if(!t&&state==='play'&&!me.car&&!isTouch&&document.pointerLockElement!==cv)t='Click the game to aim with your mouse';
  if(lap)t=`Private dance... ${Math.ceil(lap.dur-lap.t)}s left (${isTouch?'CAR':'Esc'} to leave)`;
  else if(heist.drilling)t=`Drilling the vault... ${Math.floor(heist.drill)}%${crew().length?' (crew helping)':''}`;
  else if(rob)t=`${rob.dur>8?'Cracking the cage':'Emptying the register'}... ${Math.round(rob.t/rob.dur*100)}%. Stay close`;
  else if(state==='play'&&me.jet)t=me.jet.falling?'Going down!':me.jet.z-heliGround(me.jet.x,me.jet.y)>5?(isTouch?'Stick steers, UP / DOWN climb or dive, FIRE for missiles':'Mouse steers, W/S throttle, Space climb, Shift dive, click missiles, X flares'):me.jet.speed<40?(isTouch?'Push the stick up to taxi. Tap CAR to get out':'W to throttle up, then hold Space to take off. E to get out'):'Keep speeding up, then hold Space to take off';
  else if(state==='play'&&me.heli)t=me.heli.falling?'Going down!':(me.heli.z-heliGround(me.heli.x,me.heli.y)>14?(isTouch?'UP / DOWN to fly, FIRE for rockets':(flareCd>0?'Space up, Shift down, click for rockets (flares reloading)':'Space up, Shift down, click for rockets, X flares')):(isTouch?'Tap CAR: get out':'E: get out, or Space to take off'));
  else if(state==='play'&&!me.car&&!me.inside&&heli&&!heli.dead&&!heli.falling&&Math.hypot(heli.x-me.x,heli.y-me.y)<50)t=(isTouch?'Tap CAR: ':'E: ')+'Fly the attack helicopter';
  else if(state==='play'&&!me.car&&!me.heli&&!me.jet&&!me.inside&&nearJet())t=(isTouch?'Tap CAR: ':'E: ')+'Fly the fighter jet';
  if(isTouch){$('bUp').hidden=$('bDn').hidden=$('bFlare').hidden=!(me.heli||me.jet)}
  if(!t&&stickies.length&&state==='play')t=(isTouch?'BOOM':'G')+`: detonate ${stickies.length} sticky bomb${stickies.length>1?'s':''}`;
  h.hidden=!t;h.textContent=t;
  // net text on menu
  if(state==='menu'){$('net').textContent=netState==='online'?`Live: ${Math.max(1,remotes.size+1)} in the city. Share this page's link so friends can join.`:netState==='solo'?(window.claude?'Solo mode: you are not connected. Friends need a Claude account, must be signed in, and must be invited to this page by email.':'Solo mode: the multiplayer server is not reachable.'):'Connecting to the city…'}
}

// ---------- update ----------
function update(dt){
  time+=dt;
  lockTarget=(state==='play'&&weap==='homing'&&!me.inside)?findLock():null;
  A.x=me.inside&&me.door?me.door.x:me.x;A.y=me.inside&&me.door?me.door.y:me.y;
  syncRoom(dt);
  if(state==='dead'){deadT-=dt;if(deadT<=0)respawn()}
  me.inv=Math.max(0,me.inv-dt);me.fireCd-=dt;shopCd-=dt;
  if(state==='play'&&!me.car&&!me.heli&&!me.jet&&!me.roof&&!me.climb&&shopCd<=0){
    if(me.inside){if(Math.hypot(me.inside.exit.x-me.x,me.inside.exit.y-me.y)<16)exitInt()}
    else for(const d of DOORS)if(Math.hypot(d.x-me.x,d.y-me.y)<18){enterInt(d);break}}
  if(state==='play'&&time-me.lastHurt>7&&me.hp<BAL.playerHp)me.hp=Math.min(BAL.playerHp,me.hp+5*dt);
  const play=state==='play';
  lakeFall();if(me.y<0)hillArrive();hillFog();
  // input vector
  let ix=(keys.KeyD||(!phoneOpen&&keys.ArrowRight)?1:0)-(keys.KeyA||(!phoneOpen&&keys.ArrowLeft)?1:0),iy=(keys.KeyS||(!phoneOpen&&keys.ArrowDown)?1:0)-(keys.KeyW||(!phoneOpen&&keys.ArrowUp)?1:0);
  const shift=keys.ShiftLeft||keys.ShiftRight,hu=handsUp;
  if(hu&&(ix||iy||keys.Space||mouse.down||touchFire||stick.id!==null&&(stick.x||stick.y)))handsUp=false;
  aimAssist(dt);
  if(play&&!hu&&((keys.Space&&!me.heli&&!me.jet)||mouse.down||touchFire))myShoot();
  heliStep(dt);jetStep(dt);
  if(me.climb){const c=me.climb,L=c.b.ladder,top=c.b.H+1.6;c.t+=dt;const k=Math.min(1,c.t/c.dur);me.x=L.x;me.y=L.base-4;me.z=c.up?top*k:top*(1-k);me.a=-Math.PI/2;me.vx=me.vy=0;
    if(k>=1){if(c.up){me.roof=c.b;me.y=L.top;me.z=top}else{me.roof=null;me.y=L.base;me.z=0}me.climb=null}}
  if(play&&!me.car&&!me.climb&&!me.heli&&!me.jet){
    let f=-iy,rt=ix;if(stick.id!==null){f=-stick.y;rt=stick.x}
    if(hu){f=0;rt=0}
    const cf=Math.cos(look.yaw),sf=Math.sin(look.yaw);let mx=cf*f-sf*rt,my=sf*f+cf*rt;if(drunk>0&&(f||rt)){const k=Math.min(1,drunk/25);mx+=Math.sin(time*1.9)*.6*k;my+=Math.cos(time*1.4)*.6*k}
    const l=Math.hypot(mx,my),mv=l>.15,spr=shift&&mv&&!stamOut;
    const sp=(spr?205:135)*Math.min(1,l)*(power>0?1.6:crashT>0?.7:1),k=Math.min(1,dt*(mv?14:30));
    me.vx+=((mv?mx/l*sp:0)-me.vx)*k;me.vy+=((mv?my/l*sp:0)-me.vy)*k;stamStep(spr,dt);
    me.x+=me.vx*dt;me.y+=me.vy*dt;if(me.roof&&roofAt(me.x,me.y)!==me.roof)me.roof=null;if(!me.roof)collide(me,me.x,me.y,8);footStep(dt);
    if(time-lastFireT<.6||(document.pointerLockElement===cv&&l<.15))me.a+=wrap(look.yaw-me.a)*Math.min(1,dt*18);
    else if(l>.15)me.a+=wrap(Math.atan2(my,mx)-me.a)*Math.min(1,dt*12);
    // busted: slow cops right next to you
    let near=false;for(const c of cars)if(c.kind==='police'&&heat>0&&Math.hypot(c.x-me.x,c.y-me.y)<60&&Math.hypot(c.vx,c.vy)<70)near=true;
    me.bustT=near&&!me.roof?me.bustT+dt:Math.max(0,me.bustT-dt);if(me.bustT>2.6)die('BUSTED');handsStep(dt);
    for(const[peer,r]of remotes){if(r.dead||!r.inCar)continue;const d=Math.hypot(r.x-me.x,r.y-me.y);if(d<22){const nx=(me.x-r.x)/(d||1),ny=(me.y-r.y)/(d||1);me.x+=nx*(22-d);me.y+=ny*(22-d)}}
  }
  modNitroStep(dt);
  // cars
  for(const c of cars){
    if(c.air&&c.kind!=='mine')c.air=false;if(!c.air)c.z=groundZ(c.x,c.y);
    if(c.kind==='mine'){
      let thr=-iy,st=ix,hand=shift;
      if(stick.id!==null){thr=Math.abs(stick.y)>.2?-stick.y:0;st=Math.abs(stick.x)>.15?stick.x:0}
      if(drunk>0){const k=Math.min(1,drunk/25);st=clamp(st+(Math.sin(time*1.3)*.55+Math.sin(time*3.7)*.3)*k,-1,1);if(rand()<dt*k*.8)thr*=.2}
      if(c.burn||!play){thr=0;st=0}
      drive(c,thr,st,hand,dt);
      const imp=carWalls(c);if(imp>90){damageCar(c,Math.min(BAL.crashMax,(imp-90)*.12),true);thud(imp);shake=Math.max(shake,imp/60);burst(c.x+Math.cos(c.a)*20,c.y+Math.sin(c.a)*20,6,'#ffd27a',160,.3)}
      carZ(c,dt);me.x=c.x;me.y=c.y;me.a=c.a;me.z=c.z;
      const sp=Math.hypot(c.vx,c.vy);
      for(const p of peds){if(p.down)continue;if(Math.hypot(p.x-c.x,p.y-c.y)<16&&sp>55)knockPed(p,c.vx*1.1,c.vy*1.1,true)}
      for(const[peer,r]of remotes){if(r.dead)continue;const d=Math.hypot(r.x-c.x,r.y-c.y);
        if(r.inCar&&d<26){const nx=(c.x-r.x)/(d||1),ny=(c.y-r.y)/(d||1);c.x+=nx*(26-d);c.y+=ny*(26-d);const vn=c.vx*nx+c.vy*ny;if(vn<0){c.vx-=1.2*vn*nx;c.vy-=1.2*vn*ny;if(-vn>120&&!(r.ramT>time)){r.ramT=time+.6;dmgOut[peer]=(dmgOut[peer]||0)+Math.min(BAL.crashMax,Math.round(-vn*.06))}}}
        else if(!r.inCar&&!(r.z>5)&&d<20&&sp>110&&!(r.ramT>time)){r.ramT=time+.6;dmgOut[peer]=(dmgOut[peer]||0)+Math.min(BAL.crashMax,Math.round(30+sp*.1))}}
    }
    else if(c.kind==='traffic'){
      const fx=Math.cos(c.d*Math.PI/2),fy=Math.sin(c.d*Math.PI/2);let blocked=false;
      if(c.ghost>0)c.ghost-=dt;else{
        const chk=(ox,oy,w)=>{const dx=ox-c.x,dy=oy-c.y,al=dx*fx+dy*fy;if(al>0&&al<72&&Math.abs(dx*fy-dy*fx)<w)blocked=true};
        for(const o of cars)if(o!==c&&o.kind!=='dead')chk(o.x,o.y,20);
        chk(me.x,me.y,me.car?22:14);for(const r of remotes.values())chk(r.x,r.y,18);
      }
      c.blockT=blocked?c.blockT+dt:0;if(c.blockT>3.5){c.ghost=1.6;c.blockT=0}
      c.cur+=((blocked?0:c.spd)-c.cur)*Math.min(1,(blocked?6:1.5)*dt);
      laneMove(c,dt,false);
    }
    else if(c.kind==='hill'){if(hillCarFar(c)&&(hillFrame&1))continue;hillCarStep(c,dt*(hillCarFar(c)?2:1))}
    else if(c.kind==='police')copStep(c,dt);
    else if(c.kind==='parked'||c.kind==='dead'){
      if(c.vx||c.vy){drive(c,0,0,true,dt);carWalls(c);if(Math.hypot(c.vx,c.vy)<2)c.vx=c.vy=0}
    }
    if(c.burn){c.burn-=dt;if(rand()<dt*30)parts.push({x:c.x+rr(-8,8),y:c.y+rr(-6,6),vx:rr(-15,15),vy:rr(-30,-10),life:1.2,max:1.2,col:rand()<.5?'#ff7a2e':'#ffcd4a',k:'fire',sz:rr(4,8)});
      if(c.burn<=0){c.burn=0;const mine=c===me.car;if((mine||c.lastByMe)&&job&&job.type==='wrecker')job.n++;c.kind='dead';c.color='#2c2629';c.hp=0;explode(c.x,c.y,mine||c.lastByMe,mine);if(mine){me.car=null;hurtMe(BAL.exp.player[0],me.lastHitBy)}}}
    else if(c.hp<35&&c.kind!=='dead'&&rand()<dt*6)parts.push({x:c.x+Math.cos(c.a)*18,y:c.y+Math.sin(c.a)*18,vx:rr(-10,10),vy:rr(-25,-5),life:1.6,max:1.6,col:'rgba(90,85,100,1)',k:'smoke',sz:rr(5,9)});
  }
  // car-car
  for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
    const a=cars[i],b=cars[j];if(Math.abs(a.x-b.x)>50||Math.abs(a.y-b.y)>50)continue;
    if(!dynamic(a)&&!dynamic(b))continue;
    const imp=carPair(a,b);
    if(imp>80){const mine=a.kind==='mine'||b.kind==='mine';damageCar(a,Math.min(BAL.crashMax,(imp-80)*.1),mine);damageCar(b,Math.min(BAL.crashMax,(imp-80)*.1),mine);if(mine){thud(imp);shake=Math.max(shake,imp/70)}
      if(a.kind==='police'&&b.kind==='mine'||b.kind==='police'&&a.kind==='mine')addHeat(.12)}
  }
  pedsStep(dt);
  // bullets
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];b.px=b.x;b.py=b.y;if(b.home)steerMissile(b,dt);b.x+=b.vx*dt;b.z+=(b.vz||0)*dt;b.y+=b.vy*dt;b.life-=dt;let dead=b.life<=0;
    if(b.rocket&&rand()<.8)parts.push({x:b.x,y:b.y,vx:rr(-10,10),vy:rr(-10,10),life:.9,max:.9,col:'rgba(120,110,130,1)',k:'smoke',sz:rr(3,6)});
    if(!dead&&b.rocket&&b.owner==='remote'){if(Math.hypot(b.x-me.x,b.y-me.y)<16)dead=true;else for(const r of remotes.values())if(!r.dead&&Math.hypot(b.x-r.x,b.y-r.y)<16)dead=true}
    if(!dead&&(b.z<groundZ(b.x,b.y)||solidAt(b.x,b.y,b.z)||(b.x<W+300&&(b.x<-30||b.y<HILL.edge||b.x>W+30||b.y>W+260)))){dead=true;burst(b.x,b.y,4,'#ffe9a8',90,.2)}
    if(!dead&&b.owner==='me'){
      for(const p of peds){if(!p.down&&b.z<groundZ(p.x,p.y)+24&&segDist(p.x,p.y,b.px,b.py,b.x,b.y)<8){knockPed(p,b.vx*.15,b.vy*.15,true);dead=true;break}}
      if(!dead)for(const c of cars){if(c===me.car||c.kind==='dead')continue;if(b.z<(c.z||0)+ctOf(c).h+12&&segDist(c.x,c.y,b.px,b.py,b.x,b.y)<15){c.lastByMe=true;damageCar(c,b.rocket||c.type==='armored'?0:b.dmg*BAL.bulletVeh,true);burst(b.x,b.y,5,'#ffd27a',120,.25);dead=true;break}}
      if(!dead)for(const[peer,r]of remotes){if(r.dead)continue;if(b.z>(r.inCar?(r.cz||0):(r.z||0))-3&&b.z<(r.inCar?(r.cz||0):(r.z||0))+(r.inCar?24:26)&&segDist(r.x,r.y,b.px,b.py,b.x,b.y)<(r.inCar?16:r.inHeli||r.inJet?28:11)){dmgOut[peer]=(dmgOut[peer]||0)+(r.inCar&&r.ct==='armored'?0:Math.round(b.dmg*(r.inCar?BAL.bulletVeh:r.inHeli||r.inJet?BAL.bulletAir:1)));burst(b.x,b.y,6,r.color,140,.3);dead=true;break}}
      if(!dead&&copHeli&&!copHeli.dead&&!copHeli.falling&&b.z>(copHeli.z||0)-3&&b.z<(copHeli.z||0)+28&&segDist(copHeli.x,copHeli.y,b.px,b.py,b.x,b.y)<28){copHeli.hp-=b.dmg*BAL.bulletAir;burst(b.x,b.y,6,'#ffd27a',140,.3);dead=true}
    }
    if(!dead&&b.owner==='police'&&state==='play'){const rad=me.car?16:10;if(b.z>(me.z||0)-3&&b.z<(me.z||0)+28&&segDist(me.x,me.y,b.px,b.py,b.x,b.y)<rad){if(me.jet)me.jet.hp-=b.dmg*BAL.bulletAir;else if(me.heli)me.heli.hp-=b.dmg*BAL.bulletAir;else if(me.car){if(me.car.type!=='armored')damageCar(me.car,b.dmg*BAL.bulletVeh,false),hurtMe(b.dmg*.3,null)}else hurtMe(b.dmg,null);dead=true;burst(b.x,b.y,5,'#ff6b6b',120,.25)}}
    if(dead){if(b.rocket)explode(b.x,b.y,b.owner==='me',b.owner!=='me',b.z,b.heli?BAL.heliRocketK:b.jet?BAL.jetMissileK:1);bullets.splice(i,1)}
  }
  stickyStep(dt);robStep(dt);heistStep(dt);powerStep(dt);trafficStep(dt);if(lap){lap.t+=dt;if(lap.t>=lap.dur)endLap()}
  if(scoped&&(weap!=='sniper'||me.car||me.heli||me.jet||state!=='play'||me.climb))scoped=false;
  // pickups
  for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.t-=dt;if(play&&Math.hypot(p.x-me.x,p.y-me.y)<22){if(p.powder){powder++;feed('Picked up a bag of white powder. Press N to use it')}me.cash+=p.amt;noise(.08,7000,.12);pickups.splice(i,1);continue}if(p.t<=0)pickups.splice(i,1)}
  // particles
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.15,dt);p.vy*=Math.pow(.15,dt);if(p.life<=0)parts.splice(i,1)}
  if(parts.length>700)parts.splice(0,parts.length-700);
  // heat / police population
  policeStep(dt);
  if(!cars.some(c=>c.type==='armored'&&c.kind!=='dead')){armorWait+=dt;if(armorWait>45){const[sp]=parkSpot(600,2600);if(sp){armorWait=0;cars.push(mkCar(sp[0],sp[1],sp[2],'parked','#4a5a4c','armored'));feed('An armored truck was spotted. Find the gold square on the map')}}}
  let traffic=0;for(const c of cars)if(c.kind==='traffic')traffic++;
  if(traffic<26&&rand()<dt*4)laneSpawn('traffic',560,1500);
  hillTraffic(dt);hikerStep(dt);
  if(peds.length<44&&rand()<dt*6)spawnPed();gangPop(dt);
  let parked=0;for(const c of cars)if(c.kind==='parked')parked++;
  if(parked<10&&rand()<dt*2){const[sp]=parkSpot(560,1500);if(sp)cars.push(mkCar(sp[0],sp[1],sp[2],'parked',CARCOL[Math.floor(rand()*CARCOL.length)]))}
  if(play)jobStep(dt);
  publish(dt);
  shake*=Math.pow(.02,dt);
}
function laneMove(c,dt,greedy){
  const sg=POS(c.d)?1:-1,a=along(c)+sg*c.cur*dt;
  if((a-c.tgt)*sg>=0){
    const oldRoad=c.road;setAlong(c,c.tgt);
    c.road=c.cross;c.d=c.nd;c.cross=oldRoad+(POS(c.d)?1:-1);
    decide(c,greedy);
  }else setAlong(c,a);
  c.a+=wrap(c.d*Math.PI/2-c.a)*Math.min(1,dt*9);
}
function parkSpot(min,max){
  for(let i=0;i<30;i++){
    let x,y,a;
    if(lots.length&&rand()<.5){const l=lots[Math.floor(rand()*lots.length)];const row=Math.floor(rand()*3),col=Math.floor(rand()*8);x=l.x+40+col*34;y=l.y+70+row*90;a=Math.PI/2}
    else{const road=Math.floor(rand()*(N+1)),k=Math.floor(rand()*N),al=k*B+R+30+rand()*(B-R-60),side=rand()<.5?12:108;
      if(rand()<.5){x=al;y=road*B+side;a=side<60?Math.PI:0}else{y=al;x=road*B+side;a=side<60?-Math.PI/2:Math.PI/2}}
    const d=Math.hypot(x-A.x,y-A.y);if(d<min||d>max)continue;
    let free=true;for(const c of cars)if(Math.hypot(c.x-x,c.y-y)<40)free=false;if(!free)continue;
    return[[x,y,a]];
  }
  return[null];
}

// ---------- 3D scene ----------
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:!isTouch,powerPreference:'high-performance'});
let curPR=Math.min(window.devicePixelRatio||1,isTouch?1:1.3);const maxPR=curPR;renderer.setPixelRatio(curPR);const perf={t:0,n:0};
function perfTick(raw){if(raw>.5||state==='menu')return;perf.t+=raw;perf.n++;if(perf.t>2.5){const fps=perf.n/perf.t;perf.t=perf.n=0;let np=curPR;
  if(fps<45&&curPR>.6)np=Math.max(.6,curPR-.15);else if(fps>58&&curPR<maxPR)np=Math.min(maxPR,curPR+.1);if(np!==curPR){curPR=np;renderer.setPixelRatio(curPR);resize3d()}}}
const scene=new THREE.Scene();
scene.background=new THREE.Color('#120d22');
scene.fog=new THREE.FogExp2('#160f28',0.00105);
const camera=new THREE.PerspectiveCamera(62,1,1,7000);
function resize3d(){renderer.setSize(VW,VH,false);camera.aspect=VW/Math.max(1,VH);camera.updateProjectionMatrix()}
addEventListener('resize',resize3d);resize3d();
scene.add(new THREE.HemisphereLight('#6a58a8','#1a1020',0.85));
scene.add(new THREE.AmbientLight('#3a2d55',0.45));
const moon=new THREE.DirectionalLight('#a9bbff',0.5);moon.position.set(-0.6,1,0.4);scene.add(moon);

const dummy=new THREE.Object3D();
function mergeGeos(list){const hasUv=list.every(([g])=>g.attributes.uv);let total=0;
  const parts=list.map(([g,mx])=>{const q=g.index?g.toNonIndexed():g.clone();q.applyMatrix4(mx);total+=q.attributes.position.count;return q});
  const pos=new Float32Array(total*3),nor=new Float32Array(total*3),uv=hasUv?new Float32Array(total*2):null;let o=0;
  for(const q of parts){pos.set(q.attributes.position.array,o*3);if(q.attributes.normal)nor.set(q.attributes.normal.array,o*3);if(uv)uv.set(q.attributes.uv.array,o*2);o+=q.attributes.position.count;q.dispose()}
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.BufferAttribute(pos,3));out.setAttribute('normal',new THREE.BufferAttribute(nor,3));if(uv)out.setAttribute('uv',new THREE.BufferAttribute(uv,2));out.computeBoundingSphere();return out}
function staticBatch(){
  const skip=new Set([...shopRings,roul,clubBall,beaconRing,beacon].filter(Boolean)),groups=new Map(),gone=[];scene.updateMatrixWorld(true);
  for(const o of scene.children){if(!o.isMesh||o.isInstancedMesh||skip.has(o)||Array.isArray(o.material)||o.material.transparent)continue;const g=o.geometry;if(!g.attributes.position||!g.attributes.normal)continue;
    const key=o.material.uuid+(g.attributes.uv?'u':'n');let L=groups.get(key);if(!L){L={mat:o.material,list:[]};groups.set(key,L)}L.list.push([g,o.matrixWorld.clone()]);gone.push(o)}
  for(const o of gone)scene.remove(o);
  for(const{mat,list}of groups.values()){if(list.length===1){const[g,mx]=list[0];const m=new THREE.Mesh(g,mat);m.matrixAutoUpdate=false;m.matrix.copy(mx);scene.add(m);continue}const m=new THREE.Mesh(mergeGeos(list),mat);m.matrixAutoUpdate=false;scene.add(m)}
}
function inst(mesh,i,x,y,z,ry,sx,sy,sz,rx){dummy.position.set(x,y,z);dummy.rotation.set(rx||0,ry||0,0);dummy.scale.set(sx||1,sy||1,sz||1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);return new THREE.CanvasTexture(c)}
const texCache={};
function glowTex(col){return texCache[col]||(texCache[col]=new THREE.CanvasTexture(glow(col)))}
const additive=(map,opacity)=>new THREE.MeshBasicMaterial({map,transparent:true,opacity:opacity??1,blending:THREE.AdditiveBlending,depthWrite:false});

// world textures: drawn once on canvas, tiled with RepeatWrapping. Colours match the old flat materials so the night stays as dark.
const rtex=(w,h,draw,rx,ry)=>{const t=canvasTex(w,h,draw);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx||1,ry||1);t.anisotropy=4;return t};
const grit=(g,w,h,n,seed,a)=>{const r=seeded(seed);for(let i=0;i<n;i++){g.fillStyle=r()<.5?`rgba(255,255,255,${a})`:`rgba(0,0,0,${a*1.6})`;g.fillRect(r()*w,r()*h,1+r()*1.5,1+r()*1.5)}};
function uvScale(geo,su,sv){const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);return geo}
// asphalt tile is 220 units, canvas px = world units mod 220. Roads sit at 60 mod 220, lanes at 30 and 90.
const asphTex=rtex(512,512,(g,w,h)=>{const k=w/220,r=seeded(2);g.fillStyle='#1d1b26';g.fillRect(0,0,w,h);grit(g,w,h,60000,1,.05);
 for(const[a,wd]of[[.07,9],[.12,5]]){g.fillStyle=`rgba(0,0,0,${a})`;for(const c of[24,36,84,96]){g.fillRect((c-wd/2)*k,0,wd*k,h);g.fillRect(0,(c-wd/2)*k,w,wd*k)}}
 for(let i=0;i<6;i++){g.fillStyle=r()<.5?'rgba(0,0,0,.22)':'rgba(255,255,255,.035)';g.fillRect(r()*w,r()*h,14+r()*40,10+r()*30)}
 g.strokeStyle='rgba(0,0,0,.6)';g.lineWidth=1;for(let i=0;i<7;i++){let x=r()*w,y=r()*h;g.beginPath();g.moveTo(x,y);for(let k2=0;k2<6;k2++){x+=r()*30-12;y+=r()*30-12;g.lineTo(x,y)}g.stroke()}});
const asphGeo=new THREE.PlaneGeometry(W,W);{const u=asphGeo.attributes.uv,p=asphGeo.attributes.position;for(let i=0;i<u.count;i++)u.setXY(i,(p.getX(i)+W/2)/220,1-(W/2-p.getY(i))/220)}
// sidewalk: one texture per block (block is B-R=320 units): 23 slabs per side, kerb band on the outer edge
const walkTex=rtex(512,512,(g,w,h)=>{const r=seeded(3),n=23,q=w/n;g.fillStyle='#36313f';g.fillRect(0,0,w,h);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){g.fillStyle=`rgba(${r()<.5?'255,255,255':'0,0,0'},${r()*.05})`;g.fillRect(i*q,j*q,q,q)}
 grit(g,w,h,20000,4,.05);g.fillStyle='rgba(0,0,0,.4)';for(let i=0;i<=n;i++){g.fillRect(i*q,0,1,h);g.fillRect(0,i*q,w,1)}
 g.fillStyle='#575167';g.fillRect(0,0,w,4);g.fillRect(0,h-4,w,4);g.fillRect(0,0,4,h);g.fillRect(w-4,0,4,h);
 g.fillStyle='rgba(0,0,0,.6)';g.fillRect(0,0,w,1);g.fillRect(0,h-1,w,1);g.fillRect(0,0,1,h);g.fillRect(w-1,0,1,h)});
const IN=(B-R-2*SW);
const grassTex=rtex(256,256,(g,w,h)=>{const r=seeded(5);g.fillStyle='#1f4a2c';g.fillRect(0,0,w,h);
 for(let i=0;i<1800;i++){g.strokeStyle=r()<.5?'#2a6a3a':'#16381f';const x=r()*w,y=r()*h;g.beginPath();g.moveTo(x,y);g.lineTo(x+r()*3-1.5,y-2-r()*4);g.stroke()}
 for(let i=0;i<5;i++){g.fillStyle='rgba(120,110,50,.1)';g.beginPath();g.ellipse(r()*w,r()*h,8+r()*20,5+r()*10,0,0,TAU);g.fill()}},IN/36,IN/36);
const sandTex=rtex(256,256,(g,w,h)=>{g.fillStyle='#8a7350';g.fillRect(0,0,w,h);grit(g,w,h,5000,6,.06);
 for(let y=0;y<h;y+=16){for(const[c,o]of[['rgba(255,235,190,.1)',0],['rgba(40,25,10,.16)',3]]){g.strokeStyle=c;g.lineWidth=2;g.beginPath();for(let x=0;x<=w;x+=8)g.lineTo(x,y+o+Math.sin(x/w*TAU*3+y)*3);g.stroke()}}},IN/64,IN/64);
const dockTex=rtex(256,256,(g,w,h)=>{const r=seeded(7);g.fillStyle='#2c2c31';g.fillRect(0,0,w,h);grit(g,w,h,6000,8,.05);
 g.fillStyle='rgba(0,0,0,.45)';for(let i=0;i<4;i++){g.fillRect(i*64,0,2,h);g.fillRect(0,i*64,w,2)}
 for(let i=0;i<5;i++){const x=r()*w,y=r()*h,rx=14+r()*26,gr=g.createRadialGradient(x,y,0,x,y,rx);gr.addColorStop(0,'rgba(90,130,180,.5)');gr.addColorStop(1,'rgba(90,130,180,0)');g.fillStyle=gr;g.beginPath();g.ellipse(x,y,rx,rx*.55,0,0,TAU);g.fill()}},IN/52,IN/52);
const roofTex=rtex(128,128,(g,w,h)=>{const r=seeded(9);g.fillStyle='#1c1826';g.fillRect(0,0,w,h);grit(g,w,h,3000,10,.09);
 g.fillStyle='rgba(0,0,0,.35)';for(let i=0;i<3;i++){g.beginPath();g.ellipse(r()*w,r()*h,10+r()*14,6+r()*8,0,0,TAU);g.fill()}
 for(let i=0;i<4;i++){const x=8+r()*(w-30),y=8+r()*(h-30);g.fillStyle='#34303f';g.fillRect(x,y,14,12);g.fillStyle='#0c0a12';g.fillRect(x+2,y+2,10,3)}
 g.fillStyle='#2f2b3a';g.fillRect(0,h*.62,w,3)});
const roofMat=new THREE.MeshLambertMaterial({map:roofTex});
// roof cap: the top face tiles every 60 units, the sides sample one texel
function roofBox(w,hh,d){const g=new THREE.BoxGeometry(w,hh,d),uv=g.attributes.uv;for(let k=0;k<24;k++){if(k>=8&&k<12)uv.setXY(k,uv.getX(k)*w/60,uv.getY(k)*d/60);else uv.setXY(k,.01,.01)}return g}
// facades: 4 variants for each of glass office, brick, stucco, industrial. Colour and emissive (lit windows) canvases are drawn together.
const FAC={glass:[['#2a3f66','#101a30'],['#1f4f5c','#0a2229'],['#3b3470','#171230'],['#4a4256','#1d1826']],
 brick:[['#5a3028','#2a1814'],['#4a3040','#241420'],['#5a4030','#2a1c12'],['#3c3040','#1c1420']],
 stucco:[['#4a3c58','#a99ab8'],['#3c4c58','#9db4be'],['#58423e','#bfa6a0'],['#3e5846','#a4c0aa']],
 ind:[['#3e444e','#2a2f36'],['#4a3e36','#33291f'],['#363f3a','#262d28'],['#443636','#2e2222']]};
const WTONE=['#ffcf86','#ffb86b','#fff1c4','#ff9ad5','#7fe9ff','#a9bbff'],facMats={};
function facMat(type,v){const key=type+v;if(facMats[key])return facMats[key];
 const[base,edge]=FAC[type][v],r=seeded(v*977+type.charCodeAt(0)*131),mk=()=>{const c=document.createElement('canvas');c.width=c.height=256;return c},cg=mk(),ce=mk(),g=cg.getContext('2d'),e=ce.getContext('2d');
 g.fillStyle=base;g.fillRect(0,0,256,256);e.fillStyle='#000';e.fillRect(0,0,256,256);grit(g,256,256,5000,v+5,.06);
 const lightIt=(x,y,w,h,p)=>{if(r()>=p)return;e.globalAlpha=.5+r()*.5;e.fillStyle=WTONE[Math.floor(r()*6)];e.fillRect(x,y,w,h);e.globalAlpha=1;
  if(r()<.25){e.fillStyle='#000';for(let k=y+2;k<y+h;k+=4)e.fillRect(x,k,w,2)}}; // blinds
 if(type==='ind'){
  for(let x=0;x<256;x+=4){g.fillStyle='rgba(255,255,255,.07)';g.fillRect(x,0,2,256);g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x+2,0,1,256)}
  g.fillStyle=edge;for(let x=0;x<256;x+=64)g.fillRect(x,0,2,256);g.fillRect(0,150,256,2);
  for(let i=0;i<9;i++){g.fillStyle='rgba(120,60,20,.18)';g.fillRect(r()*256,150+r()*100,2+r()*3,20+r()*60)}
  for(let x=0;x<256;x+=64){g.fillStyle='#10151c';g.fillRect(x+8,192,48,10);lightIt(x+8,192,48,10,.3)}
  const dx=60+v*30;g.fillStyle='#262b33';g.fillRect(dx,214,70,42);g.fillStyle='rgba(0,0,0,.4)';for(let y=216;y<256;y+=4)g.fillRect(dx,y,70,1);
  g.fillStyle='#c9a227';for(let x=dx;x<dx+70;x+=10)g.fillRect(x,206,5,6);lightIt(dx+20,206,30,5,.5)}
 else for(let y=0;y<8;y++)for(let x=0;x<8;x++){const X=x*32,Y=y*32;
  if(type==='glass'){g.fillStyle=shade(base,.62);g.fillRect(X+1,Y+2,30,28);g.fillStyle='rgba(255,255,255,.05)';g.fillRect(X+1,Y+2,30,10);lightIt(X+3,Y+4,26,24,.38)}
  else{if(type==='brick'&&x===0&&y===0)for(let b=0;b<256;b+=8){g.fillStyle=edge;g.fillRect(0,b,256,1);for(let c=(b/8%2)*8;c<256;c+=16)g.fillRect(c,b,1,8)}
   g.fillStyle=type==='stucco'?edge:'#8d8aa0';g.fillRect(X+7,Y+6,18,22);g.fillStyle='#14111d';g.fillRect(X+9,Y+8,14,18);lightIt(X+9,Y+8,14,18,.4);
   g.fillStyle=edge;g.fillRect(X+5,Y+27,22,3);
   const p=r();if(p<.2){g.fillStyle='#8d8aa0';g.fillRect(X+10,Y+24,12,5);g.fillStyle='#4a4756';g.fillRect(X+10,Y+28,12,1)} // AC unit
   else if(p<.32&&y>0){g.fillStyle='#aaa5b8';g.fillRect(X+2,Y+26,28,3);g.fillStyle='#6d6980';for(let b=3;b<28;b+=4)g.fillRect(X+b,Y+20,1,6)}} // balcony
  if(type==='glass'){g.fillStyle=edge;g.fillRect(X,Y,2,32);g.fillRect(X,Y,32,2)}
  if(type==='stucco'){g.fillStyle='rgba(255,255,255,.07)';g.fillRect(0,Y+30,256,2)}}
 const t=new THREE.CanvasTexture(cg),l=new THREE.CanvasTexture(ce);for(const q of[t,l]){q.wrapS=q.wrapT=THREE.RepeatWrapping;q.anisotropy=4}
 return facMats[key]=new THREE.MeshLambertMaterial({map:t,emissive:new THREE.Color('#ffffff'),emissiveMap:l})}
const facPick=b=>Math.floor(seeded((b.x*131+b.y*17)|0)()*4);
if(DBG)Object.defineProperties(DBG,{texCount:{get:()=>Object.keys(facMats).length}});

// ground
{const water=new THREE.Mesh(new THREE.PlaneGeometry(W*5,W*5),new THREE.MeshLambertMaterial({color:'#0b2436',emissive:'#05131f'}));water.rotation.x=-Math.PI/2;water.position.set(W/2,-3,W/2);scene.add(water);
 const sand=new THREE.Mesh(new THREE.PlaneGeometry(W+80,W+80),new THREE.MeshLambertMaterial({color:'#3d3242'}));sand.rotation.x=-Math.PI/2;sand.position.set(W/2,-1,W/2);scene.add(sand);
 const asph=new THREE.Mesh(asphGeo,new THREE.MeshLambertMaterial({map:asphTex}));asph.rotation.x=-Math.PI/2;asph.position.set(W/2,0,W/2);scene.add(asph);}

// lane dashes and crosswalks
{const per=Math.ceil(W/40),dash=new THREE.InstancedMesh(new THREE.BoxGeometry(20,.3,2),new THREE.MeshBasicMaterial({color:'#9c8240'}),2*(N+1)*per);let n=0;
 for(let k=0;k<=N;k++)for(let i=0;i<per;i++){const p=i*40+10;inst(dash,n++,p,.15,k*B+60,0);inst(dash,n++,k*B+60,.15,p,Math.PI/2)}
 scene.add(dash);
 const cw=new THREE.InstancedMesh(new THREE.BoxGeometry(7,.3,12),new THREE.MeshBasicMaterial({color:'#4a4658'}),(N+1)*(N+1)*4*8);n=0;
 for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const ix=i*B,iy=j*B;for(let s=12;s<R-8&&n<cw.count-4;s+=14){inst(cw,n++,ix+s,.15,iy-8,0);inst(cw,n++,ix+s,.15,iy+R+8,0);inst(cw,n++,ix-8,.15,iy+s,Math.PI/2);inst(cw,n++,ix+R+8,.15,iy+s,Math.PI/2)}}
 cw.count=n;scene.add(cw);}

// blocks
function lam0(c){return new THREE.MeshLambertMaterial({color:c})}
{const sw=new THREE.MeshLambertMaterial({map:walkTex}),inner={plaza:lam0('#3b3748'),marina:lam0('#2a3138'),skate:lam0('#2e2a26'),pit:lam0('#2a2d36'),airport:lam0('#2f333b'),hood:new THREE.MeshLambertMaterial({color:'#2e2a26'}),beach:new THREE.MeshLambertMaterial({map:sandTex}),suburb:new THREE.MeshLambertMaterial({map:grassTex}),industrial:new THREE.MeshPhongMaterial({map:dockTex,specular:'#33425a',shininess:50}),city:new THREE.MeshLambertMaterial({color:'#25212f'}),park:new THREE.MeshLambertMaterial({map:grassTex,color:'#bdccd6'}),lot:new THREE.MeshLambertMaterial({color:'#211f2a'})};
 const s=B-R,swGeo=new THREE.BoxGeometry(s,1,s),inGeo=new THREE.BoxGeometry(s-2*SW,.3,s-2*SW);
 const lines=new THREE.InstancedMesh(new THREE.BoxGeometry(1.5,.3,40),new THREE.MeshBasicMaterial({color:'#5a566a'}),lots.length*27);let ln=0;
 for(let bj=0;bj<N;bj++)for(let bi=0;bi<N;bi++){const t=blockType[bj*N+bi],cx=bi*B+R+s/2,cz=bj*B+R+s/2;
   if(t==='airport')continue;
   const a=new THREE.Mesh(swGeo,sw);a.position.set(cx,.5,cz);scene.add(a);
   const b=new THREE.Mesh(inGeo,inner[t]);b.position.set(cx,1.1,cz);scene.add(b);
   if(t==='lot')for(let r=0;r<3;r++)for(let c=0;c<=8;c++)inst(lines,ln++,bi*B+R+23+c*34,1.3,bj*B+R+70+r*90,0);
   if(t==='park'&&!cells[bj*N+bi].length&&groundZ(cx,cz)===0){const f=new THREE.Mesh(new THREE.CylinderGeometry(22,24,4,24),new THREE.MeshLambertMaterial({color:'#1d4a5a',emissive:'#0b3a44'}));f.position.set(cx,2,cz);scene.add(f)}}
 lines.count=ln;scene.add(lines);
 // trees
 let tc=0;for(const p of parks)tc+=p.trees.length;
 const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.6,2.2,14,6),new THREE.MeshLambertMaterial({color:'#4a3426'}),tc),leaf=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#2a7a4c',flatShading:true}),tc);let ti=0;
 for(const p of parks)for(const[x,y,r]of p.trees){inst(trunk,ti,x,8+groundZ(x,y),y,0);inst(leaf,ti,x,16+r*.6+groundZ(x,y),y,x,r*1.1,r*1.3,r*1.1);ti++}
 scene.add(trunk,leaf);}

// terrain meshes: one per shape, built on the heightmap cells that groundZ reads. Only cells that rise are drawn.
// Ramps get yellow and black chevrons; parks grass, the city concrete, the beach sand.
const tgrass=new THREE.MeshLambertMaterial({map:grassTex}),tsand=new THREE.MeshLambertMaterial({map:sandTex}),tconc=new THREE.MeshLambertMaterial({map:walkTex});
const twood=new THREE.MeshLambertMaterial({map:rtex(128,128,(g,w,h)=>{g.fillStyle='#6b4a32';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=16){g.fillStyle='#3e2a1c';g.fillRect(0,y,w,2);g.fillStyle='rgba(255,220,170,.06)';g.fillRect(0,y+2,w,12)}grit(g,w,h,800,11,.06)},1,1)});
const tchev=new THREE.MeshLambertMaterial({map:canvasTex(64,64,(g,w,h)=>{g.fillStyle='#ffc94a';g.fillRect(0,0,w,h);g.fillStyle='#141218';for(let k=-1;k<3;k++){g.beginPath();g.moveTo(k*32,0);g.lineTo(k*32+16,0);g.lineTo(k*32+48,h);g.lineTo(k*32+32,h);g.fill()}})});
tchev.map.wrapS=tchev.map.wrapT=THREE.RepeatWrapping;
function terrainMesh(s){
  const[i0,j0,i1,j1]=s.box,nw=i1-i0+1,nh=j1-j0+1,pos=[],uv=[],ix=[],hz=(i,j)=>HM.a[j*HM.gw+i];
  const bd=district(Math.floor((s.x-R/2)/B),Math.floor((s.y-R/2)/B)),mat=s.kind==='ramp'?tchev:s.mat==='wood'?twood:bd==='park'?tgrass:bd==='beach'?tsand:tconc;
  const sc=mat===tchev?1/40:mat===twood?1/24:mat===tconc?1/(B-R):1/IN;
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=HM.x0+i*HM.cell,z=HM.y0+j*HM.cell;pos.push(x,hz(i,j),z);uv.push(x*sc,z*sc)}
  for(let j=0;j<nh-1;j++)for(let i=0;i<nw-1;i++){const a=j*nw+i,b=a+1,c=a+nw,d=c+1;if(Math.max(hz(i0+i,j0+j),hz(i0+i+1,j0+j),hz(i0+i,j0+j+1),hz(i0+i+1,j0+j+1))<=0)continue;ix.push(a,c,b,b,c,d)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
  return new THREE.Mesh(g,mat);
}
// footpaths: visual strips that follow the slope from a park edge to the mound top (no physics)
const tpath=new THREE.MeshLambertMaterial({color:'#5d5670'});
function footpath(x0,y0,x1,y1,w){
  const L=Math.hypot(x1-x0,y1-y0),n=Math.max(2,Math.ceil(L/10)),nx=-(y1-y0)/L*w/2,ny=(x1-x0)/L*w/2,pos=[],ix=[];
  for(let k=0;k<=n;k++){const t=k/n,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t,h=groundZ(x,y)+.5;pos.push(x+nx,h,y+ny,x-nx,h,y-ny)}
  for(let k=0;k<n;k++){const a=2*k;ix.push(a,a+2,a+1,a+1,a+2,a+3)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();
  return new THREE.Mesh(g,tpath)
}
for(const[x0,y0,x1,y1]of[[hillA.x,hillA.y,hillA.x,440],[hillA.x,hillA.y,1440,hillA.y],[hillB.x,hillB.y,1440,hillB.y],[hillB.x,hillB.y,hillB.x,562]])scene.add(footpath(x0,y0,x1,y1,10));
for(const s of TERRAIN)scene.add(terrainMesh(s));
for(const m of hillMeshes())scene.add(m);
// buildings
const wallTex=canvasTex(256,256,(g)=>{g.fillStyle='#a49ebb';g.fillRect(0,0,256,256);g.fillStyle='#8c86a3';for(let y=0;y<8;y++)g.fillRect(0,y*32+29,256,3);g.fillStyle='#262233';for(let y=0;y<8;y++)for(let x=0;x<8;x++)g.fillRect(8+x*32,8+y*32,18,18)});
const litTex=canvasTex(256,256,(g)=>{g.fillStyle='#000';g.fillRect(0,0,256,256);const r=seeded(99);for(let y=0;y<8;y++)for(let x=0;x<8;x++){const v=r();if(v<.42){g.globalAlpha=.45+r()*.55;g.fillStyle=v<.1?'#7fe9ff':v<.3?'#ffcf86':'#ff9ad5';g.fillRect(8+x*32,8+y*32,18,18)}}g.globalAlpha=1});
for(const t of[wallTex,litTex]){t.wrapS=t.wrapT=THREE.RepeatWrapping}
const trimMats={},capMat=new THREE.MeshLambertMaterial({color:'#17131f'});
function boxUV(geo,w,h,d){const uv=geo.attributes.uv,sx=[d,d,w,w,w,w],sy=[h,h,d,d,h,h];for(let f=0;f<6;f++)for(let i=0;i<4;i++){const k=f*4+i;if(f===2||f===3)uv.setXY(k,.01,.01);else uv.setXY(k,uv.getX(k)*sx[f]/120,uv.getY(k)*sy[f]/120)}uv.needsUpdate=true}
const graffMats=['KINGS','LOW PALMS','LPK 4 LIFE'].map((t,i)=>new THREE.MeshBasicMaterial({transparent:true,map:canvasTex(512,136,(g)=>{const cols=[['#9a5ad8','#ffc94a'],['#ff3ea5','#29e6d6'],['#7b3fb8','#3dd68c']][i];
  g.font='bold 86px Impact, "Arial Black", sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=14;g.strokeStyle='#101010';g.strokeText(t,256,64);g.fillStyle=cols[0];g.fillText(t,256,64);
  g.lineWidth=4;g.strokeStyle=cols[1];g.strokeText(t,256,64);g.fillStyle=cols[0];for(let k=0;k<9;k++){const x=60+Math.random()*390;g.fillRect(x,92,4,14+Math.random()*30)}})}));
const bLam={},blam=(c,o)=>bLam[c]||(bLam[c]=new THREE.MeshLambertMaterial(Object.assign({color:c},o||{})));
const glassMat=new THREE.MeshLambertMaterial({color:'#6a9cc8',map:wallTex,emissive:new THREE.Color('#ffffff'),emissiveMap:litTex});
const winMat=new THREE.MeshBasicMaterial({color:'#ffd28a'}),doorMat=new THREE.MeshLambertMaterial({color:'#2a2633'}),redLight=new THREE.MeshBasicMaterial({color:'#ff2d55'});
for(const b of buildings){
  if(b.kind==='lm')continue; // landmark solids are drawn by landmarkMeshes
  const H=b.H,cx=b.x+b.w/2,cz=b.y+b.h/2;
  const put=(geo,mat,x,y,z,ry)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(ry)m.rotation.y=ry;scene.add(m);return m};
  if(b.kind==='water'){const w=new THREE.Mesh(new THREE.CircleGeometry(.5,40),new THREE.MeshLambertMaterial({color:'#12506a',emissive:'#0a3346'}));w.rotation.x=-Math.PI/2;w.scale.set(b.w+30,b.h+30,1);w.position.set(cx,1.5,cz);scene.add(w);continue}
  if(b.kind==='house'){put(new THREE.BoxGeometry(b.w,H,b.h),blam(b.roof),cx,H/2,cz);
    const rf=new THREE.Mesh(new THREE.ConeGeometry(1,1,4),blam(b.trim,{flatShading:true}));rf.rotation.y=Math.PI/4;rf.scale.set(b.w/1.38,16,b.h/1.38);rf.position.set(cx,H+8,cz);scene.add(rf);
    for(const dx of[-.28,.28]){const wn=put(new THREE.PlaneGeometry(12,9),winMat,cx+b.w*dx,H*.55,b.y+b.h+.3)}
    put(new THREE.PlaneGeometry(9,14),doorMat,cx,7,b.y+b.h+.3);continue}
  if(b.kind==='container'){put(new THREE.BoxGeometry(b.w,H,b.h),blam(b.roof),cx,H/2,cz);for(let x=-b.w/2+6;x<b.w/2;x+=8)put(new THREE.BoxGeometry(1.2,H-2,b.h+.6),blam(shade(b.roof,.7)),cx+x,H/2,cz);continue}
  if(b.kind==='shack'){put(new THREE.BoxGeometry(b.w,H,b.h),blam(b.roof),cx,H/2,cz);put(new THREE.BoxGeometry(b.w+10,2,18),blam('#ff3ea5'),cx,H-2,b.y+b.h+8);put(new THREE.PlaneGeometry(b.w*.6,8),winMat,cx,H*.5,b.y+b.h+.3);continue}
  if(b.kind==='warehouse'){const g=new THREE.BoxGeometry(b.w,H,b.h);boxUV(g,b.w,H,b.h);
    put(g,facMat('ind',facPick(b)),cx,H/2,cz);put(new THREE.PlaneGeometry(50,30),doorMat,cx+b.w*.2,15,b.y+b.h+.3);
    put(new THREE.BoxGeometry(b.w+1,1.5,b.h+1),blam('#ffc94a'),cx,H,cz);continue}
  if(b.kind==='brick'){const g=new THREE.BoxGeometry(b.w,H,b.h);boxUV(g,b.w,H,b.h);put(g,facMat('brick',facPick(b)),cx,H/2,cz);put(roofBox(b.w+1,1.6,b.h+1),roofMat,cx,H+.8,cz);
    for(let y=14;y<H-6;y+=14)put(new THREE.BoxGeometry(Math.min(30,b.w*.4),.8,6),capMat,b.x+b.w*.72,y,b.y+b.h+3);
    if(b.graffiti>=0){const gp=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(64,b.w*.8),17),graffMats[b.graffiti]);gp.position.set(cx-b.w*.1,9,b.y+b.h+.35);scene.add(gp)}
    continue}
  if(b.kind==='bank'){const gm=new THREE.MeshLambertMaterial({color:'#d4aa4c',map:wallTex,emissive:new THREE.Color('#ffffff'),emissiveMap:litTex}),gold=new THREE.MeshBasicMaterial({color:'#ffc94a'});
    const tiers=[[1,0,.62],[.78,.62,.26],[.5,.88,.12]];
    for(const[sc,y0,hh]of tiers){const w=b.w*sc,dd=b.h*sc,hgt=H*hh,g=new THREE.BoxGeometry(w,hgt,dd);boxUV(g,w,hgt,dd);put(g,gm,cx,H*y0+hgt/2,cz);put(new THREE.BoxGeometry(w+3,3,dd+3),gold,cx,H*(y0+hh),cz)}
    put(new THREE.CylinderGeometry(1.5,3.5,140,6),capMat,cx,H+70,cz);put(new THREE.BoxGeometry(5,5,5),redLight,cx,H+142,cz);
    const st=signTex('Union Bank','#ffc94a'),sm=new THREE.MeshBasicMaterial({map:st});
    for(const[ox,oz,ry]of[[0,b.h*.39+.8,0],[0,-b.h*.39-.8,Math.PI],[b.w*.39+.8,0,Math.PI/2],[-b.w*.39-.8,0,-Math.PI/2]]){const pl=new THREE.Mesh(new THREE.PlaneGeometry(150,38),sm);pl.position.set(cx+ox,H*.72,cz+oz);pl.rotation.y=ry;scene.add(pl)}
    const gl=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex('rgba(255,201,74,.35)')));gl.rotation.x=-Math.PI/2;gl.scale.set(b.w*1.6,b.h*1.6,1);gl.position.set(cx,1.8,cz);scene.add(gl);
    continue}
  const glass=b.kind==='glass',fv=facPick(b),ft=glass?'glass':(b.x*7+b.y)%3<1?'brick':'stucco';
  const geo=new THREE.BoxGeometry(b.w,H,b.h);boxUV(geo,b.w,H,b.h);
  put(geo,facMat(ft,fv),cx,H/2,cz);
  const tm=trimMats[b.trim]||(trimMats[b.trim]=new THREE.MeshBasicMaterial({color:b.trim}));
  put(new THREE.BoxGeometry(b.w+1.6,2.4,b.h+1.6),tm,cx,H,cz);
  put(roofBox(b.w-3,1.4,b.h-3),roofMat,cx,H+.9,cz);
  if(b.sign)put(new THREE.BoxGeometry(Math.min(60,b.w*.6),7,1),tm,cx,30,b.y+b.h+.6);
  if(b.vent)put(new THREE.BoxGeometry(Math.min(26,b.w*.3),8,Math.min(18,b.h*.25)),capMat,b.x+b.w*(b.vent[0]+.1),H+5,b.y+b.h*(b.vent[1]+.1));
  if(glass&&H>240){put(new THREE.CylinderGeometry(1,1.6,60,6),capMat,cx,H+30,cz);put(new THREE.BoxGeometry(3,3,3),redLight,cx,H+61,cz)}
}
landmarkMeshes(); // after graffMats
// ladders
{const rail=new THREE.MeshLambertMaterial({color:'#a7a1ba'}),rungs=[];
 for(const b of ladders){const L=b.ladder,z=b.y+b.h+1.6;for(const dx of[-5,5]){const m=new THREE.Mesh(new THREE.BoxGeometry(1,b.H+5,1),rail);m.position.set(L.x+dx,(b.H+5)/2,z);scene.add(m)}for(let y=6;y<b.H+2;y+=8)rungs.push([L.x,y,z])}
 const rm=new THREE.InstancedMesh(new THREE.BoxGeometry(10,.8,.8),rail,Math.max(1,rungs.length));rungs.forEach(([x,y,z],i)=>inst(rm,i,x,y,z,0));rm.count=rungs.length;scene.add(rm);
 const mk=new THREE.InstancedMesh(new THREE.RingGeometry(6,8,20),new THREE.MeshBasicMaterial({color:'#a7a1ba',side:THREE.DoubleSide}),Math.max(1,ladders.length));ladders.forEach((b,i)=>inst(mk,i,b.ladder.x,1.6,b.ladder.base,0,1,1,1,-Math.PI/2));mk.count=ladders.length;scene.add(mk);}
// Low Palms decor: burning barrels and a basketball court
const fireGlows=[];
{const bm=new THREE.MeshLambertMaterial({color:'#4a4038'}),bg=new THREE.CylinderGeometry(3.4,3.4,10,10);
 for(const[x,y]of barrels){const m=new THREE.Mesh(bg,bm);m.position.set(x,5,y);scene.add(m);const f=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex('rgba(255,120,40,.9)')));f.rotation.x=-Math.PI/2;f.position.set(x,10.5,y);f.userData.s=26;f.scale.set(26,26,1);scene.add(f);fireGlows.push(f);
   const gl=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex('rgba(255,140,50,.5)')));gl.rotation.x=-Math.PI/2;gl.position.set(x,1.5,y);gl.userData.s=110;gl.scale.set(110,110,1);scene.add(gl);fireGlows.push(gl)}
 for(const[x0,y0,sz]of courts){const ct=new THREE.Mesh(new THREE.PlaneGeometry(sz-50,sz-90),new THREE.MeshLambertMaterial({color:'#3a5a8a'}));ct.rotation.x=-Math.PI/2;ct.position.set(x0+sz/2,1.3,y0+sz/2-10);scene.add(ct);
   const mid=new THREE.Mesh(new THREE.BoxGeometry(sz-50,.2,1.2),new THREE.MeshBasicMaterial({color:'#e8e4f0'}));mid.position.set(x0+sz/2,1.5,y0+sz/2-10);scene.add(mid);
   for(const sx of[-1,1]){const px=x0+sz/2+sx*(sz/2-34),py=y0+sz/2-10;const pole=new THREE.Mesh(new THREE.CylinderGeometry(1,1,34,8),capMat);pole.position.set(px+sx*6,17,py);scene.add(pole);
     const bb=new THREE.Mesh(new THREE.BoxGeometry(1,12,18),new THREE.MeshLambertMaterial({color:'#e8e4f0'}));bb.position.set(px,32,py);scene.add(bb);
     const rim=new THREE.Mesh(new THREE.TorusGeometry(4,.5,6,16),new THREE.MeshBasicMaterial({color:'#ff6b3d'}));rim.rotation.x=Math.PI/2;rim.position.set(px-sx*4.5,28,py);scene.add(rim)}}}
// landscape: beach, pier, ferris wheel, palms, pools, cranes, mountains
let ferris=null;
{const sand=new THREE.Mesh(uvScale(new THREE.PlaneGeometry(W+600,300),(W+600)/IN,300/IN),new THREE.MeshLambertMaterial({map:sandTex}));sand.rotation.x=-Math.PI/2;sand.position.set(W/2,-.5,W+150);scene.add(sand);
 const surf=new THREE.Mesh(new THREE.BoxGeometry(W+600,.6,5),new THREE.MeshBasicMaterial({color:'#bfeaf5',transparent:true,opacity:.55}));surf.position.set(W/2,-.4,W+300);scene.add(surf);
 const plank=new THREE.MeshLambertMaterial({color:'#5a4030'});
 ferris=new THREE.Group();ferris.position.set(2100,140,4700);
 const rimMat=new THREE.MeshBasicMaterial({color:'#ff3ea5'}),spokeMat=new THREE.MeshBasicMaterial({color:'#29e6d6'});
 ferris.add(new THREE.Mesh(new THREE.TorusGeometry(115,2.5,8,48),rimMat));
 const spk=[],cabs=[[],[],[]],I=new THREE.Matrix4();for(let i=0;i<12;i++){const a=i/12*TAU;spk.push([new THREE.BoxGeometry(230,1.2,1.2).rotateZ(a),I]);cabs[i%3].push([new THREE.BoxGeometry(12,12,10).translate(Math.cos(a)*115,Math.sin(a)*115,0),I])}
 ferris.add(new THREE.Mesh(mergeGeos(spk),spokeMat));cabs.forEach((l,k)=>ferris.add(new THREE.Mesh(mergeGeos(l),new THREE.MeshBasicMaterial({color:['#ffc94a','#7b6bff','#3dd68c'][k]}))));
 scene.add(ferris);for(const dx of[-40,40]){const leg=new THREE.Mesh(new THREE.BoxGeometry(4,150,4),plank);leg.position.set(2100+dx,70,4700);leg.rotation.z=dx>0?-.25:.25;scene.add(leg)}
 const fg=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex('rgba(255,62,165,.4)')));fg.scale.set(420,420,1);fg.position.set(2100,140,4690);scene.add(fg);
 // palms
 const trunkG=new THREE.CylinderGeometry(1.4,2.4,1,6),trunk=new THREE.InstancedMesh(trunkG,new THREE.MeshLambertMaterial({color:'#6b4a32'}),Math.max(1,palms.length)),frond=new THREE.InstancedMesh(new THREE.BoxGeometry(24,1,6),new THREE.MeshLambertMaterial({color:'#2f8a4e'}),Math.max(1,palms.length*6));
 palms.forEach(([x,y,rot],i)=>{const h=44;inst(trunk,i,x,h/2,y,0,1,h,1);for(let k=0;k<6;k++){const a=rot+k/6*TAU;dummy.position.set(x+Math.cos(a)*10,h-2,y+Math.sin(a)*10);dummy.rotation.set(0,-a,-.45);dummy.scale.set(1,1,1);dummy.updateMatrix();frond.setMatrixAt(i*6+k,dummy.matrix)}});
 trunk.count=palms.length;frond.count=palms.length*6;scene.add(trunk,frond);
 // umbrellas
 for(const[x,y,c]of umbrellas){const u=new THREE.Mesh(new THREE.ConeGeometry(14,5,8),new THREE.MeshLambertMaterial({color:c}));u.position.set(x,20,y);scene.add(u);const p=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,20,4),M0());p.position.set(x,10,y);scene.add(p);const t=new THREE.Mesh(new THREE.BoxGeometry(10,1,20),new THREE.MeshLambertMaterial({color:'#f3ecff'}));t.position.set(x+12,1.6,y+4);scene.add(t)}
 function M0(){return new THREE.MeshLambertMaterial({color:'#d9d4e6'})}
 // pools
 const poolMat=new THREE.MeshBasicMaterial({color:'#2bb8e6'});for(const p of pools){const m=new THREE.Mesh(new THREE.PlaneGeometry(p.w,p.h),poolMat);m.rotation.x=-Math.PI/2;m.position.set(p.x+p.w/2,1.5,p.y+p.h/2);scene.add(m);const gl=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex('rgba(43,184,230,.45)')));gl.rotation.x=-Math.PI/2;gl.scale.set(90,70,1);gl.position.set(p.x+p.w/2,1.6,p.y+p.h/2);scene.add(gl)}
 // cranes
 const yel=new THREE.MeshLambertMaterial({color:'#e0a92a'});for(const[x,y]of cranes){const t=new THREE.Mesh(new THREE.BoxGeometry(7,150,7),yel);t.position.set(x,75,y);scene.add(t);const arm=new THREE.Mesh(new THREE.BoxGeometry(6,5,150),yel);arm.position.set(x,148,y-40);scene.add(arm);const l=new THREE.Mesh(new THREE.BoxGeometry(4,4,4),redLight);l.position.set(x,154,y);scene.add(l);const cb=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,60,4),capMat);cb.position.set(x,118,y-100);scene.add(cb)}
 // mountains across the bay to the north
 const mtn=[new THREE.MeshLambertMaterial({color:'#231a3d',flatShading:true,fog:false}),new THREE.MeshLambertMaterial({color:'#2b2148',flatShading:true,fog:false})],mr=seeded(77);
 for(let i=0;i<22;i++){const r0=280+mr()*380,h=380+mr()*620,m=new THREE.Mesh(new THREE.ConeGeometry(r0,h,7),mtn[i%2]);m.position.set(-1200+i*290+mr()*120,h/2-4,-2700-mr()*900);m.rotation.y=mr()*3;scene.add(m)}
 for(let i=0;i<8;i++){const r0=260+mr()*300,h=300+mr()*400,m=new THREE.Mesh(new THREE.ConeGeometry(r0,h,7),mtn[i%2]);m.position.set(-1100-mr()*700,h/2-4,-400+i*520);scene.add(m)}
 }
// street furniture, placed by rule along the road grid (every block side, every intersection corner)
{const s=B-R,lp=[],tl=[],hy=[],bn=[],bch=[],sh=[],AV=[2,4,6],mx=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z);
 for(let bj=0;bj<N;bj++)for(let bi=0;bi<N;bi++){const x0=bi*B+R,y0=bj*B+R,t=blockType[bj*N+bi];
   for(const o of[25,135,245])lp.push([x0+7,y0+o,-1,0],[x0+s-7,y0+o,1,0],[x0+o,y0+7,0,-1],[x0+o,y0+s-7,0,1]); // lamps every 110 on both sides of each road
   for(const[cx,cy]of[[0,0],[1,0],[0,1],[1,1]])tl.push([x0+(cx?s-7:7),y0+(cy?s-7:7),cx?-1:1,cy?-1:1,(bi+cx+bj+cy)%2]); // corner housing; index 4 = cycle phase group
   if(t!=='airport')hy.push([x0+10,y0+80]);
   if(t==='city')for(const[ok,x,y,ry]of[[bi,x0+8,y0+105,-Math.PI/2],[bi+1,x0+s-8,y0+105,Math.PI/2],[bj,x0+105,y0+8,Math.PI],[bj+1,x0+105,y0+s-8,0]])if(AV.includes(ok))sh.push([x,y,ry])}
 for(let i=lp.length-1;i>=0;i--)if(rampZone(lp[i][0],lp[i][1]))lp.splice(i,1); // no lamp in a ramp's landing zone
 for(const d of DOORS){const big=d.int===club||d.int===casino||d.int===bankL;for(const o of[-1,1])bch.push([d.x+o*(big?70:48),d.y-3,Math.PI]);bn.push([d.x+(big?92:72),d.y-3])}
 for(const p of parks)for(const o of[-1,1]){bch.push([p.x+p.s/2+o*45,p.y+24,0],[p.x+p.s/2+o*45,p.y+p.s-24,Math.PI]);bn.push([p.x+p.s/2+o*75,p.y+22],[p.x+p.s/2+o*75,p.y+p.s-22])}
 for(const[x,y,ry]of sh)bch.push([x,y,ry]);
 const lam=c=>new THREE.MeshLambertMaterial({color:c}),IM=(g,m,n)=>new THREE.InstancedMesh(g,m,Math.max(1,n));
 // lamps: slim pole with an arm, small tapered shade facing down and a warm bulb under it
 const post=IM(mergeGeos([[new THREE.CylinderGeometry(.9,1.3,40,6),mx(0,20,0)],[new THREE.BoxGeometry(8,1,1.2),mx(4,39.5,0)]]),lam('#2c2938'),lp.length),
  hd=IM(new THREE.CylinderGeometry(1.2,2.5,2.3,4),lam('#25222e'),lp.length),hb=IM(new THREE.SphereGeometry(.95,8,6),new THREE.MeshBasicMaterial({color:'#ffdf9e'}),lp.length),
  pool=IM(new THREE.PlaneGeometry(1,1),additive(glowTex('rgba(255,176,90,.55)'),.4),lp.length);
 lp.forEach(([x,y,dx,dz],i)=>{const ry=Math.atan2(-dz,dx),hx=x+dx*7.5,hz=y+dz*7.5;inst(post,i,x,0,y,ry);inst(hd,i,hx,39.4,hz);inst(hb,i,hx,38.35,hz);inst(pool,i,x+dx*10,1.7,y+dz*10,0,120,120,1,-Math.PI/2)});
 // traffic lights: pole, housing and two lamp cubes per corner; colours cycle green/yellow/red in trafficStep via one instanceColor pass per phase change
 const tp=IM(new THREE.CylinderGeometry(.8,1,24,6),post.material,tl.length),th=IM(new THREE.BoxGeometry(4,9,4),lam('#17131f'),tl.length),
  tc=IM(new THREE.BoxGeometry(2.6,2.6,2.6),new THREE.MeshBasicMaterial({color:'#ffffff'}),tl.length*2),
  red=new THREE.Color('#ff2d55'),grn=new THREE.Color('#3dd68c'),tlY=new THREE.Color('#ffcf4d');
 tl.forEach(([x,y,dx,dz,k],i)=>{inst(tp,i,x,13,y,0);inst(th,i,x,28,y,0);inst(tc,i*2,x-dx*2.9,28,y,0);inst(tc,i*2+1,x,28,y-dz*2.9,0);tc.setColorAt(i*2,k?red:grn);tc.setColorAt(i*2+1,k?grn:red)});
 tlPaint=ph=>{for(let i=0;i<tl.length;i++){const k=tl[i][4];for(let ax=0;ax<2;ax++){const own=(ph>>1)===(ax===k?0:1);tc.setColorAt(i*2+ax,own?(ph&1?tlY:grn):red)}}tc.instanceColor.needsUpdate=true};
 // hydrants, bins, benches, bus shelters
 const hg=mergeGeos([[new THREE.CylinderGeometry(1.8,2.2,5,8),mx(0,2.5,0)],[new THREE.SphereGeometry(1.9,8,6),mx(0,5.2,0)],[new THREE.BoxGeometry(6,1.2,1.2),mx(0,3.4,0)]]);
 const hm=IM(hg,lam('#c0283c'),hy.length);hy.forEach(([x,y],i)=>inst(hm,i,x,1,y,0));
 const bm=IM(new THREE.CylinderGeometry(2.4,2,6,8),lam('#2f3a3c'),bn.length);bn.forEach(([x,y],i)=>inst(bm,i,x,4,y,0));
 const bg=mergeGeos([[new THREE.BoxGeometry(14,1.2,4.5),mx(0,3.4,0)],[new THREE.BoxGeometry(14,5,.8),mx(0,6,-2.2)],[new THREE.BoxGeometry(1,3,4),mx(-5.5,1.5,0)],[new THREE.BoxGeometry(1,3,4),mx(5.5,1.5,0)]]);
 const be=IM(bg,lam('#5a4030'),bch.length);bch.forEach(([x,y,ry],i)=>inst(be,i,x,1.3,y,ry));
 const fr=IM(mergeGeos([[new THREE.BoxGeometry(26,1,9),mx(0,11,0)],[new THREE.BoxGeometry(1,11,1),mx(-12,5.5,-3.5)],[new THREE.BoxGeometry(1,11,1),mx(12,5.5,-3.5)]]),lam('#2a2735'),sh.length),
  pn=IM(new THREE.BoxGeometry(22,8,.6),new THREE.MeshBasicMaterial({color:'#1c6b78'}),sh.length);
 sh.forEach(([x,y,ry],i)=>{inst(fr,i,x,1.3,y,ry);const c=Math.cos(ry),sn=Math.sin(ry);inst(pn,i,x-sn*3.5,6.3,y-c*3.5,ry)});
 for(const m of[post,hd,hb,pool,tp,th,tc,hm,bm,be,fr,pn]){m.count=m===tc?tl.length*2:m===tp||m===th?tl.length:m===hm?hy.length:m===bm?bn.length:m===be?bch.length:m===fr||m===pn?sh.length:lp.length;scene.add(m)}}
// neon billboards on downtown and midtown roofs
{const names=[['Lucky Palms Casino','#c08bff'],['Velvet Palms','#ff3ea5'],['Snack & Go','#3dd68c'],['Union Bank','#ffd76a'],['Palmetto International','#29e6d6']],r=seeded(555),spots=[];
 for(const b of buildings)if((b.kind==='glass'||b.kind==='tower')&&b.H>=90&&b.w>=56&&b.x<3600&&r()<.3)spots.push(b);
 const frame=new THREE.InstancedMesh(mergeGeos([[new THREE.BoxGeometry(58,18,1),new THREE.Matrix4().makeTranslation(0,15,0)],[new THREE.BoxGeometry(2,6,2),new THREE.Matrix4().makeTranslation(-22,3,0)],[new THREE.BoxGeometry(2,6,2),new THREE.Matrix4().makeTranslation(22,3,0)]]),capMat,Math.max(1,spots.length));
 spots.forEach((b,i)=>inst(frame,i,b.x+b.w/2,b.H+1.6,b.y+b.h-5,0));frame.count=spots.length;scene.add(frame);
 names.forEach(([t,c],k)=>{const mine=spots.filter((_,i)=>i%5===k);if(!mine.length)return;
  const tex=canvasTex(1024,288,(g,w,h)=>{g.fillStyle='#0b0814';g.fillRect(0,0,w,h);g.strokeStyle=c;g.shadowColor=c;g.shadowBlur=22;g.lineWidth=10;g.strokeRect(14,14,w-28,h-28);
   let fs=150;g.font=fs+'px Bungee, Impact, sans-serif';while(g.measureText(t.toUpperCase()).width>w-110&&fs>30){fs-=6;g.font=fs+'px Bungee, Impact, sans-serif'}
   g.textAlign='center';g.textBaseline='middle';g.fillStyle=c;g.shadowBlur=28;g.fillText(t.toUpperCase(),w/2,h/2+6)});
  const pm=new THREE.InstancedMesh(new THREE.PlaneGeometry(55,15.5),new THREE.MeshBasicMaterial({map:tex}),mine.length*2);
  mine.forEach((b,i)=>{inst(pm,i*2,b.x+b.w/2,b.H+16.6,b.y+b.h-4.4,0);inst(pm,i*2+1,b.x+b.w/2,b.H+16.6,b.y+b.h-5.6,Math.PI)});scene.add(pm)})}

const shopRings=[];
// job beacon
const beacon=new THREE.Mesh(new THREE.CylinderGeometry(15,15,160,24,1,true),new THREE.MeshBasicMaterial({color:'#ffc94a',transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
beacon.position.y=80;scene.add(beacon);
const beaconRing=new THREE.Mesh(new THREE.RingGeometry(15,19,32),new THREE.MeshBasicMaterial({color:'#ffc94a',side:THREE.DoubleSide}));beaconRing.rotation.x=-Math.PI/2;beaconRing.position.y=1.8;scene.add(beaconRing);
const gpsMat=new THREE.MeshBasicMaterial({color:'#ffc94a',transparent:true,opacity:.8,depthTest:false});
const gps=new THREE.Group();{const shaft=new THREE.Mesh(new THREE.BoxGeometry(12,2.4,4.5),gpsMat);shaft.position.x=-3;const head=new THREE.Mesh(new THREE.ConeGeometry(6,11,4),gpsMat);head.rotation.z=-Math.PI/2;head.rotation.x=Math.PI/4;head.position.x=8;gps.add(shaft,head);gps.children.forEach(m=>m.renderOrder=9)}
gps.visible=false;scene.add(gps);
const reticle=new THREE.Sprite(new THREE.SpriteMaterial({map:canvasTex(128,128,(g)=>{g.strokeStyle='#ff4b4b';g.lineWidth=7;g.shadowColor='#ff4b4b';g.shadowBlur=10;for(const[x,y,dx,dy]of[[14,14,1,1],[114,14,-1,1],[14,114,1,-1],[114,114,-1,-1]]){g.beginPath();g.moveTo(x,y+dy*28);g.lineTo(x,y);g.lineTo(x+dx*28,y);g.stroke()}}),depthTest:false,transparent:true}));
reticle.scale.set(44,44,1);reticle.renderOrder=11;reticle.visible=false;scene.add(reticle);

// ---------- models ----------
const G={body:new THREE.BoxGeometry(44,8,22),hood:new THREE.BoxGeometry(12,1,20),cabin:new THREE.BoxGeometry(20,8,19),wheel:new THREE.CylinderGeometry(4.3,4.3,3.2,10),lamp:new THREE.BoxGeometry(1,2.4,4.5),bar:new THREE.BoxGeometry(3.5,2.4,7),
  torso:new THREE.BoxGeometry(5,8,7.5),head:new THREE.BoxGeometry(5,5,5),leg:new THREE.BoxGeometry(2.8,8,2.8),gun:new THREE.BoxGeometry(8,1.6,1.6),blob:new THREE.CircleGeometry(1,16),tracer:new THREE.BoxGeometry(16,.7,.7),rocket:new THREE.BoxGeometry(10,2.4,2.4),cash:new THREE.BoxGeometry(5,3,5)};
const M={glass:new THREE.MeshLambertMaterial({color:'#141225',emissive:'#0d1630'}),wheel:new THREE.MeshLambertMaterial({color:'#0c0b10'}),head:new THREE.MeshBasicMaterial({color:'#fff3c4'}),tail:new THREE.MeshBasicMaterial({color:'#ff2b3b'}),
  black:new THREE.MeshLambertMaterial({color:'#121018'}),char:new THREE.MeshLambertMaterial({color:'#231f22'}),shadow:new THREE.MeshBasicMaterial({color:'#000',transparent:true,opacity:.42,depthWrite:false}),
  red:new THREE.MeshBasicMaterial({color:'#ff2d55'}),blue:new THREE.MeshBasicMaterial({color:'#2d6bff'}),dim:new THREE.MeshBasicMaterial({color:'#2a2633'}),gun:new THREE.MeshLambertMaterial({color:'#2a2833'}),
  tracer:new THREE.MeshBasicMaterial({color:'#ffe9a8'}),ptracer:new THREE.MeshBasicMaterial({color:'#7fb2ff'}),rocket:new THREE.MeshLambertMaterial({color:'#c9c3d6'}),cash:new THREE.MeshBasicMaterial({color:'#3dd68c'}),
  beam:additive(glowTex('rgba(255,236,190,.55)')),redGlow:additive(glowTex('rgba(255,45,85,.8)')),blueGlow:additive(glowTex('rgba(45,107,255,.8)')),fire:additive(glowTex('rgba(255,120,40,.9)'))};
const colMats={};
const lam=c=>colMats[c]||(colMats[c]=new THREE.MeshLambertMaterial({color:c}));
const boxCache={};const box=(x,y,z)=>{const k=x+','+y+','+z;return boxCache[k]||(boxCache[k]=new THREE.BoxGeometry(x,y,z))};
M.white=new THREE.MeshBasicMaterial({color:'#f3ecff'});M.taxi=new THREE.MeshBasicMaterial({color:'#ffe27a'});
// ---- car environment reflections (night city cube map) ----
const carEnv=(()=>{const faces=[];const er=seeded(31);
  for(let f=0;f<6;f++){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
    if(f===2){g.fillStyle='#1a1230';g.fillRect(0,0,128,128)}else if(f===3){g.fillStyle='#0a0810';g.fillRect(0,0,128,128)}
    else{const gr=g.createLinearGradient(0,0,0,128);gr.addColorStop(0,'#241a44');gr.addColorStop(.48,'#5a2a6a');gr.addColorStop(.52,'#ff7ad9');gr.addColorStop(.56,'#2a1a3a');gr.addColorStop(1,'#0a0810');g.fillStyle=gr;g.fillRect(0,0,128,128);
      for(let i=0;i<60;i++){g.fillStyle=['#ffd28a','#7fe9ff','#ff9ad5','#ffffff'][Math.floor(er()*4)];g.globalAlpha=.5+er()*.5;const w=2+er()*5;g.fillRect(er()*128,40+er()*28,w,w*1.4)}g.globalAlpha=1}
    faces.push(c)}
  const cube=new THREE.CubeTexture(faces);cube.needsUpdate=true;const pm=new THREE.PMREMGenerator(renderer);const rt=pm.fromCubemap(cube);pm.dispose();return rt.texture})();
const paintCache={};const paint=c=>paintCache[c]||(paintCache[c]=new THREE.MeshPhysicalMaterial({color:c,metalness:.45,roughness:.32,clearcoat:1,clearcoatRoughness:.08,envMap:carEnv,envMapIntensity:1.1}));
const glassM=new THREE.MeshPhysicalMaterial({color:'#0b0e1c',metalness:.9,roughness:.05,envMap:carEnv,envMapIntensity:1.4,side:THREE.DoubleSide});
const tintM=new THREE.MeshPhysicalMaterial({color:'#05060c',metalness:.9,roughness:.05,envMap:carEnv,envMapIntensity:1.4,side:THREE.DoubleSide});
const chromeM=new THREE.MeshStandardMaterial({color:'#e8e6f0',metalness:1,roughness:.18,envMap:carEnv});
const tireM=new THREE.MeshStandardMaterial({color:'#141318',roughness:.9,metalness:0});
const trimM=new THREE.MeshStandardMaterial({color:'#18161e',roughness:.6,metalness:.2,envMap:carEnv});
M.white=new THREE.MeshBasicMaterial({color:'#f3ecff'});M.taxi=new THREE.MeshBasicMaterial({color:'#ffe27a'});
const headM=new THREE.MeshBasicMaterial({color:'#fff6d8'}),tailM=new THREE.MeshBasicMaterial({color:'#ff1f3a'}),brakeM=new THREE.MeshBasicMaterial({color:'#ff7a88'});
// ---- car shapes: lofted body + glass cabin ----
const CSHAPE={
  sedan:{base:2.6,deck:10.6,belt:11.2,hood:9.8,RH:6.6,tR:.22,tF:.64,roofW:.78,n:5.5},
  taxi:{base:2.6,deck:10.6,belt:11.2,hood:9.8,RH:6.6,tR:.22,tF:.64,roofW:.78,n:5.5},
  police:{base:2.6,deck:10.8,belt:11.4,hood:10,RH:6.6,tR:.22,tF:.64,roofW:.78,n:5.5},
  sports:{base:2.2,deck:9.2,belt:9.6,hood:8.2,RH:5,tR:.28,tF:.6,roofW:.7,n:4.6},
  muscle:{base:2.5,deck:10.4,belt:10.8,hood:10.4,RH:5.6,tR:.2,tF:.52,roofW:.74,n:6},
  suv:{base:3.8,deck:13.6,belt:13.8,hood:12.8,RH:8.4,tR:.07,tF:.68,roofW:.88,n:6.5},
  van:{base:3.4,deck:14.4,belt:14.4,hood:12.8,RH:8.4,tR:.03,tF:.9,roofW:.92,n:7},
  pickup:{base:3.6,deck:12.6,belt:12.8,hood:12.2,RH:7.6,tR:.42,tF:.7,roofW:.86,n:6.5},
  armored:{base:3.6,deck:15.4,belt:15.4,hood:14.4,RH:6,tR:.1,tF:.82,roofW:.9,n:10}};
const sm3=x=>{x=clamp(x,0,1);return x*x*(3-2*x)},lerp=(a,b,t)=>a+(b-a)*t;
const spow=(v,n)=>Math.sign(v)*Math.pow(Math.abs(v),2/n);
function loftGeo(st,M,n,cabin){
  const pos=[],idx=[],S=st.length,ring=M;
  const pt=(q,j)=>{if(cabin){const th=Math.PI*j/(M-1),c=spow(Math.cos(th),n),sv=Math.abs(spow(Math.sin(th),n)),hw=q.hw+(q.hwTop-q.hw)*sv;return[q.x,q.cy+q.hh*sv,c*hw]}
    const th=TAU*j/M;return[q.x,q.cy+spow(Math.sin(th),n)*q.hh,spow(Math.cos(th),n)*q.hw]};
  for(const q of st)for(let j=0;j<M;j++)pos.push(...pt(q,j));
  const span=cabin?M-1:M;
  for(let i=0;i<S-1;i++)for(let j=0;j<span;j++){const a=i*ring+j,b=i*ring+(j+1)%ring,c=(i+1)*ring+j,dd=(i+1)*ring+(j+1)%ring;idx.push(a,c,b,b,c,dd)}
  for(const[i,front]of[[0,false],[S-1,true]]){const q=st[i],start=pos.length/3;for(let j=0;j<M;j++)pos.push(...pt(q,j));const ci=pos.length/3;pos.push(q.x,cabin?q.cy+q.hh*.35:q.cy,0);
    for(let j=0;j<span;j++){const a=start+j,b=start+(j+1)%ring;front?idx.push(ci,b,a):idx.push(ci,a,b)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g}
const carGeoCache={};
function carGeo(type){if(carGeoCache[type])return carGeoCache[type];
  const T=CT[type]||CT.sedan,P=CSHAPE[type]||CSHAPE.sedan,L=T.len,Wd=T.wid;
  const hwAt=t=>{const e=Math.max(0,(Math.abs(t-.5)-.36)/.14);return Wd/2*(1-.2*e*e)};
  const topAt=t=>{let y=t<P.tR?lerp(P.deck*.9,P.deck,sm3(t/.12)):t<P.tF?P.belt:lerp(P.belt,P.hood,sm3((t-P.tF)/Math.max(.05,.9-P.tF)));if(t>.93)y=lerp(y,P.hood*.82,(t-.93)/.07);if(t<.05)y=lerp(P.deck*.8,y,t/.05);return y};
  const st=[],N=30;for(let i=0;i<=N;i++){const t=i/N,e=Math.max(0,(Math.abs(t-.5)-.4)/.1),bot=P.base+e*1.6,top=topAt(t),end=(i===0||i===N)?.86:1;st.push({x:-L/2+t*L,cy:(top+bot)/2,hh:(top-bot)/2*end,hw:hwAt(t)*end})}
  const body=loftGeo(st,24,P.n,false);
  const cs=[],NC=16;for(let i=0;i<=NC;i++){const u=i/NC,t=lerp(P.tR,P.tF,u),ramp=Math.pow(sm3(Math.min(1,u/.3))*sm3(Math.min(1,(1-u)/.4)),.55),rh=Math.max(.2,P.RH*ramp);cs.push({x:-L/2+t*L,cy:P.belt-.4,hh:rh+.4,hw:hwAt(t)*.95,hwTop:hwAt(t)*P.roofW})}
  const cabin=loftGeo(cs,18,P.n*.9,true);
  {const p=cabin.attributes.position,ix=cabin.index.array,roof=[],glass=[],A=new THREE.Vector3(),Bv=new THREE.Vector3(),Cv=new THREE.Vector3();
   for(let k=0;k<ix.length;k+=3){A.fromBufferAttribute(p,ix[k]);Bv.fromBufferAttribute(p,ix[k+1]);Cv.fromBufferAttribute(p,ix[k+2]);const nrm=Bv.clone().sub(A).cross(Cv.clone().sub(A)).normalize();(nrm.y>.86?roof:glass).push(ix[k],ix[k+1],ix[k+2])}
   cabin.setIndex(roof.concat(glass));cabin.clearGroups();cabin.addGroup(0,roof.length,0);cabin.addGroup(roof.length,glass.length,1)}
  const wr=(type==='suv'||type==='pickup'||type==='van'||type==='armored')?5.4:type==='sports'?4.1:4.5;
  return carGeoCache[type]={L,Wd,P,body,cabin,wr,hwAt,topAt,roofY:P.belt+P.RH}}
const wheelCache={};
function wheelGeo(wr){if(wheelCache[wr])return wheelCache[wr];
  const tire=new THREE.TorusGeometry(wr-1.15,1.25,12,24);tire.scale(1,1,1.25);
  const rim=new THREE.CylinderGeometry(wr*.6,wr*.6,1.6,20);rim.rotateX(Math.PI/2);
  const spoke=new THREE.BoxGeometry(wr*1.12,.55,.5),hub=new THREE.CylinderGeometry(.7,.7,2,10);hub.rotateX(Math.PI/2);
  const arch=new THREE.TorusGeometry(wr+.6,.75,6,16,Math.PI);
  return wheelCache[wr]={tire,rim,spoke,hub,arch}}
const rimCache={},carMergeCache={};
function rimGeo(wr,sz){const k=wr+'|'+sz;if(rimCache[k])return rimCache[k];const W=wheelGeo(wr),m4=(x,y,z,rz)=>{const o=new THREE.Object3D();o.position.set(x,y,z);o.rotation.z=rz||0;o.updateMatrix();return o.matrix.clone()};
  const list=[[W.rim,m4(0,0,sz*.3)],[W.hub,m4(0,0,sz*.6)]];for(let i=0;i<5;i++)list.push([W.spoke,m4(0,0,sz*1.05,i*TAU/5)]);return rimCache[k]=mergeGeos(list)}
const neonM={};const neonMat=c=>neonM[c]||(neonM[c]=additive(glowTex(rgbaOf(c,1)),.9));
const modKey=(color,m)=>m?`${color}|${m.rim||''}|${m.tint?1:0}|${m.neon||''}`:'';
// mods (optional): rim colour, tint and neon underglow colour. The cache key is modKey(color,mods).
function carMesh(color,type,mods){
  const T=CT[type]||CT.sedan,cop=type==='police',C=carGeo(type),L=C.L,Wd=C.Wd,P=C.P,g=new THREE.Group(),ud=g.userData,col=cop?'#eef0f6':color,pm=paint(col);
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);return m};
  const sh=new THREE.Mesh(G.blob,M.shadow);sh.rotation.x=-Math.PI/2;sh.scale.set(L*.62,Wd*.78,1);sh.position.y=.35;g.add(sh);
  ud.body=add(C.body,pm,0,0,0);ud.cabin=add(C.cabin,[pm,mods&&mods.tint?tintM:glassM],0,0,0);
  // wheels
  const W=wheelGeo(C.wr),wz=Wd/2-2.1;ud.wheels=[];
  for(const x of[L*.31,-L*.31])for(const sz of[1,-1]){const wg=new THREE.Group();wg.position.set(x,C.wr,sz*wz);
    wg.add(new THREE.Mesh(W.tire,tireM));wg.add(new THREE.Mesh(rimGeo(C.wr,sz),mods&&mods.rim?lam(mods.rim):chromeM));
    g.add(wg);ud.wheels.push(wg)}
  // lights, bumpers, grille, mirrors, exhaust
  const hf=C.topAt(.97),hr=C.topAt(.03),hwF=C.hwAt(.97),hwR=C.hwAt(.03);
  for(const z of[1,-1]){const h=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),headM);h.scale.set(.5,.95,1.7);h.position.set(L/2-.9,hf-1.9,z*hwF*.62);g.add(h);
    add(box(.5,1.1,hwR*.7),tailM,-L/2+.4,hr-1.5,z*hwR*.48)}
  add(box(1.6,2,Wd-2),trimM,L/2-.2,P.base+1.1,0);add(box(1.6,2,Wd-2),trimM,-L/2+.2,P.base+1.1,0);
  add(box(.5,1.8,hwF*.95),trimM,L/2-.1,hf-3.2,0);
  for(const z of[1,-1])add(box(1.4,1.1,1.6),pm,L*(P.tF-.5)-1,P.belt+.9,z*(C.hwAt(P.tF)+.6));
  if(type!=='van'&&type!=='armored')for(const z of[2.5,-2.5]){const ex=add(new THREE.CylinderGeometry(.55,.55,2,8),chromeM,-L/2-.2,P.base+.9,z);ex.rotation.z=Math.PI/2}
  // per-type details
  if(type==='muscle')for(const z of[2.6,-2.6])add(box(L*.26,.25,2),M.white,L*.36,C.topAt(.82)+.1,z),add(box(L*(P.tF-P.tR)*.5,.25,2),M.white,L*((P.tR+P.tF)/2-.5),C.roofY+.15,z);
  if(type==='sports'){add(box(3,.6,Wd-1.5),trimM,-L/2+2.2,P.deck+3,0);for(const z of[6,-6])add(box(1,2.6,1),trimM,-L/2+2.4,P.deck+1.5,z)}
  if(type==='taxi')add(box(5,2.6,9),M.taxi,L*(((P.tR+P.tF)/2)-.5),C.roofY+1.3,0);
  if(type==='pickup'){add(box(L*.38,.6,Wd-3.4),trimM,-L*.28,P.deck-.1,0);for(const z of[1,-1])add(box(L*.38,2.2,.8),pm,-L*.28,P.deck+1,z*(Wd/2-1.2))}
  if(type==='armored'){for(const y of[P.belt-3,P.base+4])add(box(L+.6,1.1,Wd+.4),trimM,0,y,0);add(box(3,5,Wd+1.5),trimM,L/2+1.2,P.base+3.2,0)}
  if(cop){for(const z of[1,-1])add(box(L*.42,3,.3),trimM,L*.02,P.base+4.6,z*(Wd/2+.05))}
  const beam=new THREE.Mesh(new THREE.PlaneGeometry(1,1),M.beam);beam.rotation.x=-Math.PI/2;beam.scale.set(90,55,1);beam.position.set(L/2+40,.8,0);g.add(beam);ud.beam=beam;
  if(cop){const rx=L*(((P.tR+P.tF)/2)-.5);ud.l1=add(G.bar,M.red,rx,C.roofY+1.2,3.6);ud.l2=add(G.bar,M.blue,rx,C.roofY+1.2,-3.6);
    ud.glow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),M.redGlow);ud.glow.rotation.x=-Math.PI/2;ud.glow.scale.set(140,140,1);ud.glow.position.y=1;g.add(ud.glow)}
  const det=new THREE.Group(),keep=new Set([ud.body,ud.cabin,ud.beam,ud.l1,ud.l2,ud.glow]),buckets=new Map();ud.detail=det;
  for(const ch of[...g.children]){if(keep.has(ch)||ch.geometry===G.blob)continue;g.remove(ch);if(ch.isGroup){det.add(ch);continue}ch.updateMatrix();
    const key=ch.material===pm?'paint':ch.material.uuid;let b=buckets.get(key);if(!b){b={mat:ch.material,list:[]};buckets.set(key,b)}b.list.push([ch.geometry,ch.matrix.clone()])}
  for(const[key,b]of buckets){const ck=type+'|'+key,m=new THREE.Mesh(carMergeCache[ck]||(carMergeCache[ck]=mergeGeos(b.list)),b.mat);det.add(m);if(b.mat===tailM)ud.brakes=m}
  g.add(det);
  if(mods&&mods.neon){const pl=new THREE.Mesh(new THREE.PlaneGeometry(1,1),neonMat(mods.neon));pl.rotation.x=-Math.PI/2;pl.scale.set(L*1.7,Wd*2.1,1);pl.position.y=.6;g.add(pl);ud.neon=pl;
    const lt=new THREE.PointLight(mods.neon,1.2,90);lt.position.y=5;g.add(lt);ud.neonL=lt}
  ud.mk=modKey(color,mods);
  return g;
}
const HAIRC=['#1a120c','#3a2416','#6a4a22','#c9a24a','#111111','#7a2f3a'];
const PG2={arm:new THREE.BoxGeometry(2.2,8,2.2),ftorso:new THREE.BoxGeometry(4.6,7.6,6.2),mtorso:new THREE.BoxGeometry(5.2,8,7.8),fleg:new THREE.BoxGeometry(2.4,8,2.4),mcap:new THREE.BoxGeometry(5.4,1.5,5.4),fcap:new THREE.BoxGeometry(5.6,1.8,5.6),ftail:new THREE.BoxGeometry(2.2,8,5.2),
  skirt:new THREE.CylinderGeometry(2.6,4.4,5.6,8),btop:new THREE.BoxGeometry(4.9,2.2,6.5),bbot:new THREE.BoxGeometry(4.9,2.4,6.5)};
function personMesh(shirt,skin,armed,o){o=o||{};const fem=!!(o.fem||o.bikini),bik=!!o.bikini;
  const g=new THREE.Group(),ud=g.userData,hairM=lam(o.hair||HAIRC[Math.floor(rand()*HAIRC.length)]);
  const sh=new THREE.Mesh(G.blob,M.shadow);sh.rotation.x=-Math.PI/2;sh.scale.set(6,6,1);sh.position.y=.4;g.add(sh);
  const legM=bik?lam(skin):M.black;
  for(const z of fem?[1.5,-1.5]:[2,-2]){const hip=new THREE.Group();hip.position.set(0,8,z);const l=new THREE.Mesh(fem?PG2.fleg:G.leg,legM);l.position.y=-4;hip.add(l);g.add(hip);if(z>0)ud.l1=hip;else ud.l2=hip}
  const t=new THREE.Mesh(fem?PG2.ftorso:PG2.mtorso,lam(bik?skin:shirt));t.position.y=12;g.add(t);ud.torso=t;ud.shirtParts=bik?[]:[t];
  if(bik){const c=lam(shirt),tp=new THREE.Mesh(PG2.btop,c),bt=new THREE.Mesh(PG2.bbot,c);tp.position.y=13.9;bt.position.y=8.9;g.add(tp,bt);ud.shirtParts=[tp,bt]}
  else if(fem&&o.skirt){const sk=new THREE.Mesh(PG2.skirt,lam(o.skirt));sk.position.y=6.4;g.add(sk)}
  const h=new THREE.Mesh(G.head,lam(skin));h.position.y=18.6;if(fem)h.scale.setScalar(.94);g.add(h);
  if(fem){const cap=new THREE.Mesh(PG2.fcap,hairM);cap.position.y=21.1;g.add(cap);ud.cap=cap;ud.hair=hairM;const tl=new THREE.Mesh(PG2.ftail,hairM);tl.position.set(-2.3,17.2,0);g.add(tl)}
  else{const cap=new THREE.Mesh(PG2.mcap,hairM);cap.position.y=21.4;g.add(cap);ud.cap=cap;ud.hair=hairM}
  const gun=new THREE.Mesh(G.gun,M.gun);gun.position.set(6,12,3.5);gun.visible=!!armed;g.add(gun);ud.gun=gun;
  const arm=z=>{const pv=new THREE.Group(),m=new THREE.Mesh(PG2.arm,lam(bik?skin:shirt));pv.position.set(0,15,z);m.position.y=-4;pv.add(m);g.add(pv);return[pv,m]};
  const[a1,m1]=arm(-4.2),[a2,m2]=arm(4.2);ud.a1=a1;ud.a2=a2;if(!bik)ud.shirtParts.push(m1,m2);
  if(fem)g.scale.setScalar(.95);
  return g;
}
function setShirt(m,c){const mt=lam(c);for(const p of m.userData.shirtParts)p.material=mt}
function animPerson(m,ph){const s=Math.sin(ph)*.6;m.userData.l1.rotation.z=s;m.userData.l2.rotation.z=-s;m.userData.a1.rotation.z=s*.5;m.userData.a2.rotation.z=-s*.5}
function labelSprite(){const c=document.createElement('canvas');c.width=256;c.height=72;const t=new THREE.CanvasTexture(c);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true}));s.scale.set(48,13.5,1);s.renderOrder=10;s.userData={c,t,key:''};return s}
function drawLabel(s,name,color,hp){const key=name+color+Math.round(hp/5);if(s.userData.key===key)return;s.userData.key=key;const g=s.userData.c.getContext('2d');g.clearRect(0,0,256,72);
  g.font='700 30px "Chakra Petch", sans-serif';g.textAlign='center';const w=Math.min(250,g.measureText(name).width+20);g.fillStyle='rgba(10,8,20,.75)';g.fillRect(128-w/2,4,w,40);g.fillStyle=color;g.fillText(name,128,35);
  g.fillStyle='rgba(255,255,255,.2)';g.fillRect(78,54,100,8);g.fillStyle=hp<35?'#ff4b4b':'#29e6d6';g.fillRect(78,54,hp,8);s.userData.t.needsUpdate=true}
function cartMesh(){const g=new THREE.Group(),cart=new THREE.Mesh(new THREE.BoxGeometry(12,9,9),lam('#c9c3d6')),top=new THREE.Mesh(new THREE.ConeGeometry(9,4,8),lam('#ff3ea5'));cart.position.set(14,4.5,0);top.position.set(14,15,0);g.add(cart,top);return g}
const barkTexs=new Map();
function barkTex(s,col){const k=s+col;let t=barkTexs.get(k);if(!t){t=canvasTex(256,64,(g)=>{g.font='700 28px "Chakra Petch", sans-serif';g.textAlign='center';g.textBaseline='middle';const w=Math.min(250,g.measureText(s).width+24);g.fillStyle='rgba(10,8,20,.8)';g.fillRect(128-w/2,8,w,48);g.fillStyle=col;g.fillText(s,128,33)});barkTexs.set(k,t)}return t}
function barkSprite(){const s=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthTest:false}));s.scale.set(44,11,1);s.position.y=30;s.renderOrder=10;return s}

// doors and interiors
const rgbaOf=(hex,a)=>{const n=parseInt(hex.slice(1),16);return`rgba(${n>>16},${n>>8&255},${n&255},${a})`};
// slot screens: one lit canvas per colour, shared by every machine of that colour
const scrMats={};
function screenMat(c){return scrMats[c]||(scrMats[c]=new THREE.MeshBasicMaterial({map:canvasTex(96,68,(g)=>{g.fillStyle='#07040c';g.fillRect(0,0,96,68);g.fillStyle=c;g.shadowColor=c;g.shadowBlur=10;for(let i=0;i<3;i++)g.fillRect(12+i*26,22,18,24);g.fillRect(8,6,80,4)})}))}
function signTex(text,col){return canvasTex(512,128,(g)=>{g.fillStyle='#0b0814';g.fillRect(0,0,512,128);g.strokeStyle=col;g.lineWidth=8;g.strokeRect(6,6,500,116);g.font=(text.length>10?'50px':'62px')+' Bungee, Impact, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle=col;g.shadowColor=col;g.shadowBlur=18;g.fillText(text.toUpperCase(),256,68)})}
{const signs={};
 for(const d of DOORS){
   const big=d.int===club||d.int===casino||d.int===bankL,tex=signs[d.label]||(signs[d.label]=signTex(d.label,d.col));
   const ring=new THREE.Mesh(new THREE.RingGeometry(13,17,32),new THREE.MeshBasicMaterial({color:d.col,transparent:true,opacity:.85,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(d.x,1.6,d.y);scene.add(ring);shopRings.push(ring);
   const booth=new THREE.Mesh(box(big?90:44,big?44:30,8),capMat);booth.position.set(d.x,big?22:15,d.y+16);scene.add(booth);
   const door=new THREE.Mesh(new THREE.PlaneGeometry(18,24),new THREE.MeshBasicMaterial({color:d.col,transparent:true,opacity:.4}));door.position.set(d.x,12,d.y+11.9);door.rotation.y=Math.PI;scene.add(door);
   const sg=new THREE.Mesh(new THREE.PlaneGeometry(big?96:56,big?24:14),new THREE.MeshBasicMaterial({map:tex}));sg.position.set(d.x,big?54:38,d.y+11.8);sg.rotation.y=Math.PI;scene.add(sg);
   const pl=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex(rgbaOf(d.col,.5))));pl.rotation.x=-Math.PI/2;pl.scale.set(big?170:110,big?170:110,1);pl.position.set(d.x,1.7,d.y);scene.add(pl);
 }}
const intAnim=[];let danceFloor=null,tv=null,tileT=0;
const tileCols=['#ff3ea5','#29e6d6','#ffc94a','#7b6bff','#3dd68c'].map(c=>new THREE.Color(c));
for(const r of INT){
  const cx=r.ox+r.w/2,cz=r.oy+r.h/2;
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(r.w,r.h),lam(r.col));fl.rotation.x=-Math.PI/2;fl.position.set(cx,.2,cz);scene.add(fl);
  const wm=new THREE.MeshLambertMaterial({color:new THREE.Color(r.col).multiplyScalar(2.6),emissive:new THREE.Color(r.col).multiplyScalar(.7)}),t=14;
  for(const[x,z,w,dd]of[[cx,r.oy-t/2,r.w+2*t,t],[cx,r.oy+r.h+t/2,r.w+2*t,t],[r.ox-t/2,cz,t,r.h],[r.ox+r.w+t/2,cz,t,r.h]]){const m=new THREE.Mesh(box(w,72,dd),wm);m.position.set(x,36,z);scene.add(m)}
  const ce=new THREE.Mesh(new THREE.PlaneGeometry(r.w,r.h),M.black);ce.rotation.x=Math.PI/2;ce.position.set(cx,72,cz);scene.add(ce);
  for(let i=1;i<=2;i++){const st=new THREE.Mesh(box(Math.round(r.w*.6),1,4),new THREE.MeshBasicMaterial({color:r===club?'#ff3ea5':r===casino?'#ffc94a':'#fff1d6'}));st.position.set(cx,70,r.oy+r.h*i/3);scene.add(st)}
  for(const p of r.props){if(p.tbl)continue;const m=new THREE.Mesh(box(p.w,p.ht,p.h),lam(p.col));m.position.set(p.x+p.w/2,p.ht/2,p.y+p.h/2);scene.add(m)}
  const ex=new THREE.Mesh(new THREE.PlaneGeometry(26,40),new THREE.MeshBasicMaterial({color:'#29e6d6',transparent:true,opacity:.5}));ex.position.set(r.exit.x,20,r.oy+r.h-.5);ex.rotation.y=Math.PI;scene.add(ex);
  const er=new THREE.Mesh(new THREE.RingGeometry(10,13,28),new THREE.MeshBasicMaterial({color:'#29e6d6',side:THREE.DoubleSide}));er.rotation.x=-Math.PI/2;er.position.set(r.exit.x,.6,r.exit.y);scene.add(er);shopRings.push(er);
  for(const p of r.spots){const sr=new THREE.Mesh(new THREE.RingGeometry(9,12,28),new THREE.MeshBasicMaterial({color:'#ffc94a',side:THREE.DoubleSide}));sr.rotation.x=-Math.PI/2;sr.position.set(p.x,.6,p.y);scene.add(sr);shopRings.push(sr)}
}
// gun shop racks
for(let i=0;i<8;i++){const gm=new THREE.Mesh(box(22,3,2),M.gun);gm.position.set(gunInt.ox+24+i*29,30+(i%2)*9,gunInt.oy+11);scene.add(gm)}
// store shelves
for(const sx of[30,80,130])for(let j=0;j<3;j++){const it=new THREE.Mesh(box(15,3,86),lam(['#ff6b3d','#ffc94a','#4aa3ff'][j]));it.position.set(store.ox+sx+7,8+j*8,store.oy+85);scene.add(it)}
{const fr=new THREE.Mesh(box(200,30,1),new THREE.MeshBasicMaterial({color:'#bff6ff'}));fr.position.set(store.ox+120,22,store.oy+8.6);scene.add(fr)}
// safehouse
{const pil=new THREE.Mesh(box(14,4,60),M.white);pil.position.set(home.ox+28,12,home.oy+60);scene.add(pil);
 tv=new THREE.Mesh(new THREE.PlaneGeometry(60,22),new THREE.MeshBasicMaterial({color:'#4aa3ff'}));tv.position.set(home.ox+190,20,home.oy+6.2);scene.add(tv);
 const rug=new THREE.Mesh(new THREE.PlaneGeometry(90,60),lam('#3a2a4a'));rug.rotation.x=-Math.PI/2;rug.position.set(home.ox+170,.4,home.oy+100);scene.add(rug)}
// Velvet Palms club
const clubLights=['#ff3ea5','#29e6d6'].map(c=>{const l=new THREE.PointLight(c,1.6,340,2);scene.add(l);return l});
{const poleMat=new THREE.MeshBasicMaterial({color:'#e6e1f0'});
 [160,220,280].forEach((dx,i)=>{const pole=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,64,8),poleMat);pole.position.set(club.ox+dx,38,club.oy+48);scene.add(pole);
   const m=personMesh(['#ff3ea5','#ffc94a','#29e6d6'][i],['#c98b6b','#f1c9a5','#8d5a3b'][i],false,{bikini:true,hair:['#2a1a12','#c9a24a','#111111'][i]});scene.add(m);intAnim.push({m,kind:'dancer',cx:club.ox+dx,cz:club.oy+48,ph:i*2.1})});
 const bt=personMesh('#1d1830','#e0b48f',false);bt.position.set(club.ox+8,0,club.oy+185);scene.add(bt);intAnim.push({m:bt,kind:'bob',ph:1});
 const dj=personMesh('#7b6bff','#6b4630',false);dj.position.set(club.ox+400,0,club.oy+170);dj.rotation.y=Math.PI;scene.add(dj);intAnim.push({m:dj,kind:'bob',ph:2});
 for(let i=0;i<7;i++){const m=personMesh(SHIRT[i%SHIRT.length],PEDCOL[i%PEDCOL.length],false);m.position.set(club.ox+130+(i%4)*50+rr(-8,8),0,club.oy+150+Math.floor(i/4)*60+rr(-8,8));m.rotation.y=Math.PI/2;scene.add(m);intAnim.push({m,kind:'bob',ph:i})}
 danceFloor=new THREE.InstancedMesh(box(28,.4,28),new THREE.MeshBasicMaterial({color:'#ffffff'}),40);
 for(let j=0;j<5;j++)for(let i=0;i<8;i++){const k=j*8+i;inst(danceFloor,k,club.ox+115+i*30,.5,club.oy+110+j*30,0);danceFloor.setColorAt(k,tileCols[k%tileCols.length])}
 scene.add(danceFloor);}
let roul=null,clubBall=null;
{const ox=casino.ox,oy=casino.oy;
 const dealer=personMesh('#111018','#e0b48f',false);dealer.position.set(ox+210,0,oy+30);dealer.rotation.y=-Math.PI/2;scene.add(dealer);intAnim.push({m:dealer,kind:'bob',ph:3});
 const pd=personMesh('#111018','#e0b48f',false);pd.position.set(ox+215,0,oy+270);pd.rotation.y=-Math.PI/2;scene.add(pd);intAnim.push({m:pd,kind:'bob',ph:6});
 const rd=personMesh('#2a1a3e','#c98b6b',false);rd.position.set(ox+310,0,oy+150);rd.rotation.y=-Math.PI/2;scene.add(rd);intAnim.push({m:rd,kind:'bob',ph:7});
 const bar=personMesh('#1d1830','#8d5a3b',false);bar.position.set(ox+578,0,oy+145);bar.rotation.y=Math.PI/2;scene.add(bar);intAnim.push({m:bar,kind:'bob',ph:4});
 for(const[y,c]of[[53,'#ff3ea5'],[83,'#29e6d6'],[113,'#ffc94a'],[143,'#ff3ea5'],[173,'#29e6d6'],[203,'#ffc94a'],[243,'#ffd84a'],[273,'#ffd84a']]){const sc=new THREE.Mesh(new THREE.PlaneGeometry(14,10),screenMat(c));sc.position.set(ox+30.2,22,oy+y);sc.rotation.y=Math.PI/2;scene.add(sc)}
 for(let i=0;i<3;i++){const g=personMesh(SHIRT[(i+2)%SHIRT.length],PEDCOL[(i+1)%PEDCOL.length],false);g.position.set(ox+44,0,oy+[80,160,262][i]);g.rotation.y=Math.PI;scene.add(g);intAnim.push({m:g,kind:'bob',ph:i*1.7})}
 for(let i=0;i<2;i++){const g=personMesh(SHIRT[(i+4)%SHIRT.length],PEDCOL[(i+3)%PEDCOL.length],false);g.position.set(ox+410+i*34,0,oy+262);g.rotation.y=Math.PI/2;scene.add(g);intAnim.push({m:g,kind:'bob',ph:i})}
 const glowAt=(x,y,w,h,c)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),additive(glowTex(c)));m.rotation.x=-Math.PI/2;m.position.set(ox+x,.5,oy+y);scene.add(m)};
 glowAt(210,62,220,70,'rgba(41,230,214,.6)');glowAt(310,200,150,120,'rgba(255,201,74,.6)');glowAt(440,175,170,110,'rgba(192,139,255,.65)');glowAt(215,312,200,110,'rgba(61,214,140,.6)');glowAt(548,385,160,120,'rgba(255,62,165,.7)');glowAt(30,135,44,190,'rgba(255,62,165,.45)');glowAt(545,240,130,70,'rgba(255,216,74,.5)');
 const felt=lam('#145a3a'),wheelTop=canvasTex(128,128,(g)=>{for(let i=0;i<36;i++){g.fillStyle=i===0?'#1f8a4c':i%2?'#c2202f':'#141018';g.beginPath();g.moveTo(64,64);g.arc(64,64,62,i/36*TAU,(i+1)/36*TAU);g.closePath();g.fill()}g.fillStyle='#ffc94a';g.beginPath();g.arc(64,64,14,0,TAU);g.fill()});
 roul=new THREE.Mesh(new THREE.CylinderGeometry(22,22,2,32),[lam('#5a3a22'),new THREE.MeshBasicMaterial({map:wheelTop}),lam('#5a3a22')]);roul.position.set(casino.ox+310,11.2,casino.oy+200);scene.add(roul);
 const chipMat=['#ff3ea5','#29e6d6','#ffc94a','#f3ecff'].map(c=>new THREE.MeshBasicMaterial({color:c})),chipG=new THREE.CylinderGeometry(2.2,2.2,1.2,12);
 for(let i=0;i<10;i++){const c=new THREE.Mesh(chipG,chipMat[i%4]);c.position.set(ox+170+(i%5)*20,11.6+Math.floor(i/5)*1.3,oy+70);scene.add(c)}
 const cardM=new THREE.MeshBasicMaterial({color:'#f8f5ff'});for(let i=0;i<4;i++){const c=new THREE.Mesh(new THREE.BoxGeometry(5,.3,7),cardM);c.position.set(ox+185+i*14,11.3,oy+56);c.rotation.y=rr(-.2,.2);scene.add(c)}}
{const clerk=personMesh('#3dd68c','#c98b6b',false);clerk.position.set(store.ox+205,0,store.oy+13);clerk.rotation.y=-Math.PI/2;scene.add(clerk);intAnim.push({m:clerk,kind:'bob',ph:5});
 const cashier=personMesh('#ffc94a','#8d5a3b',false);cashier.position.set(casino.ox+495,0,casino.oy+40);cashier.rotation.y=-Math.PI/2;scene.add(cashier);
 const bars=new THREE.MeshLambertMaterial({color:'#c9c3d6'});for(let i=0;i<8;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(1,30,1),bars);b.position.set(casino.ox+462+i*9,15,casino.oy+37);scene.add(b)}
 const lw=new THREE.Mesh(new THREE.CylinderGeometry(22,22,3,32),new THREE.MeshBasicMaterial({map:canvasTex(128,128,(g)=>{for(let i=0;i<20;i++){g.fillStyle=i%2?'#ffc94a':'#ff3ea5';g.beginPath();g.moveTo(64,64);g.arc(64,64,62,i/20*TAU,(i+1)/20*TAU);g.closePath();g.fill()}g.fillStyle='#16121f';g.beginPath();g.arc(64,64,12,0,TAU);g.fill()})}));
 lw.rotation.x=Math.PI/2;lw.position.set(casino.ox+75,62,casino.oy+372);scene.add(lw);
 const rs=new THREE.Mesh(new THREE.PlaneGeometry(56,24),new THREE.MeshBasicMaterial({color:'#2a0f4a'}));rs.position.set(casino.ox+440,30,casino.oy+202);scene.add(rs);
 const hs=new THREE.Mesh(new THREE.PlaneGeometry(80,16),new THREE.MeshBasicMaterial({color:'#3dd68c'}));hs.position.set(casino.ox+545,30,casino.oy+262);scene.add(hs);
 const vs=new THREE.Mesh(new THREE.PlaneGeometry(60,20),new THREE.MeshBasicMaterial({map:signTex('VIP','#ffc94a'),transparent:true}));vs.position.set(casino.ox+545,34,casino.oy+323);vs.rotation.y=Math.PI;scene.add(vs)}
// Casino look with no real lights (a real light slows every lit material in the scene). Emissive panels,
// neon trim, a diamond carpet and felt tables are plain materials and canvas textures, merged at boot.
{const ox=casino.ox,oy=casino.oy,cw=casino.w,ch=casino.h;
 const carpet=canvasTex(256,256,(g)=>{g.fillStyle='#2a0f22';g.fillRect(0,0,256,256);
   for(const[cx,cy]of[[0,0],[256,0],[0,256],[256,256],[128,128]]){g.beginPath();g.moveTo(cx,cy-62);g.lineTo(cx+62,cy);g.lineTo(cx,cy+62);g.lineTo(cx-62,cy);g.closePath();g.fillStyle='#8a6a1e';g.fill();
     g.beginPath();g.moveTo(cx,cy-46);g.lineTo(cx+46,cy);g.lineTo(cx,cy+46);g.lineTo(cx-46,cy);g.closePath();g.fillStyle='#5a1640';g.fill();
     g.fillStyle='#ffc94a';g.beginPath();g.arc(cx,cy,5,0,TAU);g.fill()}});
 carpet.wrapS=carpet.wrapT=THREE.RepeatWrapping;carpet.repeat.set(cw/128,ch/128);
 const cp=new THREE.Mesh(new THREE.PlaneGeometry(cw,ch),new THREE.MeshLambertMaterial({map:carpet}));cp.rotation.x=-Math.PI/2;cp.position.set(ox+cw/2,.4,oy+ch/2);scene.add(cp);
 const ceil=canvasTex(512,360,(g)=>{g.fillStyle='#24102e';g.fillRect(0,0,512,360);
   g.strokeStyle='rgba(255,201,74,.5)';g.lineWidth=5;for(let i=1;i<4;i++){g.beginPath();g.moveTo(i*128,0);g.lineTo(i*128,360);g.stroke()}
   for(let j=1;j<3;j++){g.beginPath();g.moveTo(0,j*120);g.lineTo(512,j*120);g.stroke()}
   g.fillStyle='#fff0c4';g.shadowColor='#ffb85c';g.shadowBlur=28;for(const[x,y]of[[96,60],[416,60],[96,300],[416,300]])g.fillRect(x-36,y-16,72,32)});
 const cl=new THREE.Mesh(new THREE.PlaneGeometry(cw,ch),new THREE.MeshBasicMaterial({map:ceil}));cl.rotation.x=Math.PI/2;cl.position.set(ox+cw/2,71.5,oy+ch/2);scene.add(cl);
 const pink=new THREE.MeshBasicMaterial({color:'#ff3ea5'}),cyan=new THREE.MeshBasicMaterial({color:'#29e6d6'});
 const trim=(m,x,y,z,w,h,d)=>{const t=new THREE.Mesh(box(w,h,d),m);t.position.set(x,y,z);scene.add(t)};
 for(const y of[5,64]){trim(pink,ox+cw/2,y,oy+.8,cw,2.6,1.2);trim(cyan,ox+.8,y,oy+ch/2,1.2,2.6,ch);trim(pink,ox+cw-.8,y,oy+ch/2,1.2,2.6,ch)}
 for(const p of casino.props)if(p.tbl){const cx=p.x+p.w/2,cz=p.y+p.h/2,top=p.ht,felt=p.col==='#1d2a5a'?'#2a4a8c':'#1f7a48';
   const rim=new THREE.Mesh(box(p.w,2.4,p.h),lam('#6b4426'));rim.position.set(cx,top-1.2,cz);scene.add(rim);
   const fm=new THREE.Mesh(box(p.w-8,.6,p.h-8),lam(felt));fm.position.set(cx,top+.3,cz);scene.add(fm);
   for(const[dx,dz]of[[-1,-1],[1,-1],[-1,1],[1,1]]){const lg=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,top-2.4,6),lam('#3a2212'));lg.position.set(cx+dx*(p.w/2-6),(top-2.4)/2,cz+dz*(p.h/2-6));scene.add(lg)}}}
const bankFx={lasers:[],door:null,gold:null};
{const L=bankL,S=bankS,V=bankV;
 for(const[x,y]of[[150,120],[290,120],[150,220],[290,220]]){const c=new THREE.Mesh(new THREE.CylinderGeometry(7,7,72,12),lam('#cfc8b8'));c.position.set(L.ox+x,36,L.oy+y);scene.add(c)}
 const lt=new THREE.Mesh(new THREE.PlaneGeometry(150,36),new THREE.MeshBasicMaterial({map:signTex('Union Bank','#ffc94a')}));lt.position.set(L.ox+220,48,L.oy+.6);scene.add(lt);
 for(let k=0;k<3;k++){const pc=new THREE.Mesh(new THREE.BoxGeometry(14,10,1),new THREE.MeshBasicMaterial({color:'#7fe9ff'}));pc.position.set(L.ox+40,18,L.oy+80+k*76+1);scene.add(pc)}
 for(let k=0;k<4;k++)for(let j=0;j<6;j++){const led=new THREE.Mesh(new THREE.BoxGeometry(2,2,1),new THREE.MeshBasicMaterial({color:j%2?'#3dd68c':'#29e6d6'}));led.position.set(S.ox+40+k*62+(j%3)*6,14+Math.floor(j/3)*16,S.oy+88.6);scene.add(led)}
 const scr=new THREE.Mesh(new THREE.PlaneGeometry(56,20),new THREE.MeshBasicMaterial({color:'#3dd68c'}));scr.position.set(S.ox+190,24,S.oy+140);scr.rotation.x=-.2;scene.add(scr);
 bankFx.door=new THREE.Group();bankFx.door.position.set(V.ox+210-48,0,V.oy+31);const dm=new THREE.Mesh(new THREE.CylinderGeometry(46,46,8,32),lam('#9a8a5a'));dm.rotation.x=Math.PI/2;dm.position.set(48,48,0);bankFx.door.add(dm);
 for(let k=0;k<6;k++){const sp=new THREE.Mesh(new THREE.BoxGeometry(40,3,3),lam('#6a5f3c'));sp.position.set(48,48,4.5);sp.rotation.z=k*Math.PI/6;bankFx.door.add(sp)}scene.add(bankFx.door);
 bankFx.gold=new THREE.Group();const gm=new THREE.MeshBasicMaterial({color:'#ffc94a'});for(const[x,y]of[[64,32],[356,32],[210,84]])for(let k=0;k<9;k++){const bar=new THREE.Mesh(new THREE.BoxGeometry(10,4,5),gm);bar.position.set(V.ox+x-12+(k%3)*12,2+Math.floor(k/3)*4.2,V.oy+y-6+((k*7)%3)*5);bankFx.gold.add(bar)}scene.add(bankFx.gold);
 const lm=new THREE.MeshBasicMaterial({color:'#ff2d2d',transparent:true,opacity:.85});for(let i=0;i<3;i++){const l=new THREE.Mesh(new THREE.BoxGeometry(V.w-24,1.2,1.2),lm);l.position.set(V.ox+V.w/2,12,0);scene.add(l);const l2=new THREE.Mesh(new THREE.BoxGeometry(V.w-24,1.2,1.2),lm);l2.position.set(V.ox+V.w/2,22,0);scene.add(l2);bankFx.lasers.push([l,l2])}}
function bankAnim(dt){for(let i=0;i<3;i++){const y=laserY(i);for(const l of bankFx.lasers[i])l.position.z=y}
  const open=!!(heist.bits&8);bankFx.door.rotation.y+=((open?-1.6:0)-bankFx.door.rotation.y)*Math.min(1,dt*1.5);bankFx.gold.visible=open}
const lapDancer=personMesh('#ff3ea5','#f1c9a5',false,{bikini:true,hair:'#2a1a12'});lapDancer.visible=false;scene.add(lapDancer);
{const C=club,neon=c=>new THREE.MeshBasicMaterial({color:c}),pinkT=new THREE.MeshBasicMaterial({color:'#ff3ea5',transparent:true,opacity:.28,side:THREE.DoubleSide});
 const cur1=new THREE.Mesh(new THREE.PlaneGeometry(90,60),pinkT);cur1.position.set(C.ox+330,30,C.oy+285);cur1.rotation.y=Math.PI/2;scene.add(cur1);
 const cur2=new THREE.Mesh(new THREE.PlaneGeometry(60,60),pinkT);cur2.position.set(C.ox+410,30,C.oy+240);scene.add(cur2);
 const vip=new THREE.Mesh(new THREE.PlaneGeometry(60,20),new THREE.MeshBasicMaterial({map:signTex('VIP','#ff3ea5'),transparent:true}));vip.position.set(C.ox+386,46,C.oy+329.3);vip.rotation.y=Math.PI;scene.add(vip);
 for(const[x,z,c]of[[110,20,'#ff3ea5'],[330,20,'#29e6d6'],[110,80,'#29e6d6'],[330,80,'#ff3ea5']]){const n=new THREE.Mesh(new THREE.BoxGeometry(2,60,2),neon(c));n.position.set(C.ox+x,36,C.oy+z);scene.add(n)}
 const edge=new THREE.Mesh(new THREE.BoxGeometry(220,1,1.5),neon('#ff3ea5'));edge.position.set(C.ox+220,6.2,C.oy+80.5);scene.add(edge);
 const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(9,1),new THREE.MeshPhongMaterial({color:'#e6e1f0',emissive:'#555',shininess:150,specular:'#ffffff',flatShading:true}));ball.position.set(C.ox+220,60,C.oy+170);scene.add(ball);clubBall=ball;
 for(const[x,y]of[[70,295],[140,295],[300,180]]){const cs=new THREE.Mesh(new THREE.BoxGeometry(50,8,18),lam('#5a1a4a'));cs.position.set(C.ox+x,4,C.oy+y+10);scene.add(cs)}
 const st=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex('rgba(255,62,165,.5)')));st.rotation.x=-Math.PI/2;st.scale.set(260,120,1);st.position.set(C.ox+220,6.4,C.oy+50);scene.add(st)}
function lapAnim(dt){lapDancer.visible=!!lap;if(!lap)return;const t=lap.t,ud=lapDancer.userData,spin=(t%7)>6?((t%7)-6)*TAU:0;
  lapDancer.position.set(club.ox+386+Math.sin(t*1.1)*5,Math.abs(Math.sin(t*3.2))*1.4,club.oy+274+Math.sin(t*.8)*4);lapDancer.rotation.set(0,-Math.PI/2+Math.sin(t*2)*.45+spin,Math.sin(t*3.2)*.08);
  ud.l1.rotation.z=Math.sin(t*3.2)*.25;ud.l2.rotation.z=-Math.sin(t*3.2)*.25;ud.a1.rotation.z=0;ud.a2.rotation.z=0;ud.a1.rotation.x=-(1.9+Math.sin(t*3)*.5);ud.a2.rotation.x=1.9+Math.sin(t*3+1)*.5}
function animInteriors(dt){
  for(const f of fireGlows){const k=f.userData.s*(.85+Math.random()*.3);f.scale.set(k,k,1)}
  lapAnim(dt);landmarkTick();if(clubBall)clubBall.rotation.y+=dt*.8;
  bankAnim(dt);
  if(ferris)ferris.rotation.z+=dt*.12;
  if(roul)roul.rotation.y+=dt*1.6;
  clubHype=Math.max(0,clubHype-dt);const sp=clubHype>0?2.4:1;
  for(const a of intAnim){if(a.kind==='dancer'){a.ph+=dt*sp*1.1;a.m.position.set(a.cx+Math.cos(a.ph)*6,6+Math.abs(Math.sin(a.ph*2.5))*2,a.cz+Math.sin(a.ph)*6);a.m.rotation.y=-a.ph-Math.PI/2;animPerson(a.m,a.ph*3)}
    else a.m.position.y=Math.abs(Math.sin(time*4*sp+a.ph))*1.6}
  tileT-=dt;if(tileT<=0&&danceFloor){tileT=.4/sp;for(let i=0;i<danceFloor.count;i++)danceFloor.setColorAt(i,tileCols[(rand()*tileCols.length)|0]);danceFloor.instanceColor.needsUpdate=true}
  clubLights[0].position.set(club.ox+220+Math.cos(time)*150,58,club.oy+165+Math.sin(time*1.3)*110);
  clubLights[1].position.set(club.ox+220-Math.cos(time*.8)*150,58,club.oy+165-Math.sin(time*1.1)*110);
  if(tv)tv.material.color.setHSL(.58+Math.sin(time*3)*.05,.7,.45+Math.sin(time*11)*.08);
}
function heliMesh(){const g=new THREE.Group(),ud=g.userData,mil=lam('#3b4838'),dk=M.black,body=new THREE.Group();g.add(body);ud.body=body;
  const add=(geo,mat,x,y,z,p)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);(p||body).add(m);return m};
  add(box(36,13,16),mil,0,12,0);add(box(12,9,14),M.glass,18,13,0);add(box(10,7,12),mil,26,10,0);add(box(46,4,4),mil,-39,15,0);add(box(9,13,1.5),mil,-60,21,0);add(box(14,1.2,8),mil,-58,16,0);
  add(box(6,1.2,30),mil,4,11,0);for(const z of[-14,14]){const p=add(new THREE.CylinderGeometry(2.4,2.4,16,8),dk,4,9,z);p.rotation.z=Math.PI/2}
  for(const z of[-8,8]){add(box(42,1.3,1.3),dk,0,1,z);for(const x of[-10,10])add(box(1.3,6,1.3),dk,x,4,z)}
  add(box(2,2,2),M.red,-62,26,0);add(box(1.6,1.6,1.6),M.tail,4,11.5,-15.5);add(box(1.6,1.6,1.6),new THREE.MeshBasicMaterial({color:'#3dff7a'}),4,11.5,15.5);
  const rot=new THREE.Group();rot.position.set(0,21,0);for(let i=0;i<2;i++){const bl=new THREE.Mesh(box(112,.7,4),dk);bl.rotation.y=i*Math.PI/2;rot.add(bl)}add(new THREE.CylinderGeometry(2.4,2.4,4,8),dk,0,0,0,rot);body.add(rot);ud.rotor=rot;
  const tr=new THREE.Group();tr.position.set(-60,18,1.8);for(let i=0;i<2;i++){const bl=new THREE.Mesh(box(1,15,1.2),dk);bl.rotation.z=i*Math.PI/2;tr.add(bl)}body.add(tr);ud.trotor=tr;
  const beam=new THREE.Mesh(new THREE.PlaneGeometry(1,1),M.beam);beam.rotation.x=-Math.PI/2;beam.scale.set(110,110,1);ud.beam=beam;
  return g}
const heliObj=heliMesh();scene.add(heliObj);
const heliShadow=new THREE.Mesh(G.blob,M.shadow);heliShadow.rotation.x=-Math.PI/2;scene.add(heliShadow);
// police helicopter: body and rotor from the same model, plus a searchlight aimed at the player
const copHeliObj=heliMesh();copHeliObj.visible=false;scene.add(copHeliObj);
const copHeliCone=new THREE.Mesh(new THREE.ConeGeometry(1,1,16,1,true),new THREE.MeshBasicMaterial({color:'#d8ecff',transparent:true,opacity:.14,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
copHeliCone.visible=false;scene.add(copHeliCone);
const copHeliSpot=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex('rgba(190,224,255,.85)'),.75));copHeliSpot.rotation.x=-Math.PI/2;copHeliSpot.visible=false;scene.add(copHeliSpot);
const copHeliUp=new THREE.Vector3(0,1,0),copHeliAim=new THREE.Vector3();
function copHeliDraw(dt){
  const h=copHeli,live=!!h&&!h.dead;copHeliObj.visible=live;
  if(!live){copHeliCone.visible=copHeliSpot.visible=false;return}
  copHeliObj.position.set(h.x,h.z,h.y);copHeliObj.rotation.set(0,-h.a,0);
  copHeliObj.userData.rotor.rotation.y+=dt*(h.falling?46:26);copHeliObj.userData.trotor.rotation.z+=dt*(h.falling?70:40);
  const beam=!h.falling;copHeliCone.visible=copHeliSpot.visible=beam;
  if(!beam)return;
  const tz=groundZ(me.x,me.y)+1,dx=me.x-h.x,dy=tz-h.z,dz=me.y-h.y,len=Math.hypot(dx,dy,dz)||1;
  copHeliAim.set(-dx,-dy,-dz).divideScalar(len);copHeliCone.quaternion.setFromUnitVectors(copHeliUp,copHeliAim);
  copHeliCone.position.set(h.x+dx/2,h.z+dy/2,h.y+dz/2);const rad=clamp(len*.22,16,40);copHeliCone.scale.set(rad,len,rad);
  copHeliSpot.position.set(me.x,tz+.5,me.y);const s=44+Math.sin(time*9)*3;copHeliSpot.scale.set(s,s,1);
}
{const pad=new THREE.Mesh(new THREE.CircleGeometry(62,40),lam('#2a2733'));pad.rotation.x=-Math.PI/2;pad.position.set(PAD.x,1.7,PAD.y);scene.add(pad);
 const hT=canvasTex(256,256,(g)=>{g.strokeStyle='#ffc94a';g.lineWidth=12;g.beginPath();g.arc(128,128,112,0,TAU);g.stroke();g.fillStyle='#f3ecff';g.font='170px Bungee, Impact, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('H',128,138)});
 const hm=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial({map:hT,transparent:true}));hm.rotation.x=-Math.PI/2;hm.position.set(PAD.x,1.9,PAD.y);scene.add(hm);
 for(let i=0;i<12;i++){const a=i/12*TAU,l=new THREE.Mesh(box(3,2,3),new THREE.MeshBasicMaterial({color:'#3dff7a'}));l.position.set(PAD.x+Math.cos(a)*64,2.5,PAD.y+Math.sin(a)*64);scene.add(l)}}
// airport, fighter jets, powder dealer
{const x0=8*B,y1=6*B;
 const tar=new THREE.Mesh(new THREE.PlaneGeometry(W-x0,y1),lam('#262830'));tar.rotation.x=-Math.PI/2;tar.position.set((x0+W)/2,.35,y1/2);scene.add(tar);
 const rw=new THREE.Mesh(new THREE.PlaneGeometry(96,y1-120),lam('#15161a'));rw.rotation.x=-Math.PI/2;rw.position.set(RWX,.5,y1/2);scene.add(rw);
 const dmat=new THREE.MeshBasicMaterial({color:'#e8e4f0'}),dashes=new THREE.InstancedMesh(box(3,.2,30),dmat,Math.ceil(y1/70));let n=0;for(let y=110;y<y1-110;y+=70)inst(dashes,n++,RWX,.62,y,0);dashes.count=n;scene.add(dashes);
 for(const yy of[85,y1-85])for(let i=-4;i<=4;i++){const st=new THREE.Mesh(box(6,.2,24),dmat);st.position.set(RWX+i*10,.62,yy);scene.add(st)}
 const lights=[];for(let y=70;y<y1-60;y+=60)for(const sx of[-52,52])lights.push([RWX+sx,y]);
 const lm=new THREE.InstancedMesh(box(2.4,1.4,2.4),new THREE.MeshBasicMaterial({color:'#7fe9ff'}),lights.length);lights.forEach(([x,y],i)=>inst(lm,i,x,1.2,y,0));scene.add(lm);
 const sig=new THREE.Mesh(new THREE.PlaneGeometry(150,34),new THREE.MeshBasicMaterial({map:signTex('Palmetto Intl','#7fe9ff')}));sig.position.set(8*B+R+160,52,R+150.8);scene.add(sig);
 const cab=new THREE.Mesh(box(80,22,80),glassMat);cab.position.set(8*B+R+150,182,5*B+R+150);scene.add(cab);
 const bcn=new THREE.Mesh(box(4,4,4),redLight);bcn.position.set(8*B+R+150,198,5*B+R+150);scene.add(bcn);
 const dl=personMesh('#26232e','#6b4630',false);dl.position.set(DEALER.x,0,DEALER.y);dl.rotation.y=-Math.PI/4;scene.add(dl);
 const dr=new THREE.Mesh(new THREE.RingGeometry(9,12,24),new THREE.MeshBasicMaterial({color:'#f3ecff',side:THREE.DoubleSide}));dr.rotation.x=-Math.PI/2;dr.position.set(DEALER.x+12,.8,DEALER.y+12);scene.add(dr);shopRings.push(dr)}
function jetMesh(){const g=new THREE.Group(),ud=g.userData,body=new THREE.Group();g.add(body);ud.body=body;
  const grey=new THREE.MeshPhongMaterial({color:'#7d8594',shininess:60,specular:'#666666'}),dark=lam('#3a404a'),wingM=new THREE.MeshPhongMaterial({color:'#6e7685',shininess:40,side:THREE.DoubleSide});
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);body.add(m);return m};
  add(new THREE.CylinderGeometry(3.4,4.2,46,14),grey,-2,7,0).rotation.z=Math.PI/2;
  add(new THREE.ConeGeometry(3.4,16,14),grey,29,7,0).rotation.z=-Math.PI/2;
  add(new THREE.SphereGeometry(2.8,14,10),glassM,13,10.2,0).scale.set(3.2,1.1,1);
  const ws=new THREE.Shape();ws.moveTo(8,0);ws.lineTo(-12,22);ws.lineTo(-19,22);ws.lineTo(-17,0);ws.closePath();
  const wg=new THREE.ExtrudeGeometry(ws,{depth:1,bevelEnabled:false});wg.rotateX(Math.PI/2);add(wg,wingM,0,6.6,2.5);add(wg,wingM,0,6.6,-2.5).scale.z=-1;
  const fs=new THREE.Shape();fs.moveTo(-12,0);fs.lineTo(-20,13);fs.lineTo(-24,13);fs.lineTo(-23,0);fs.closePath();
  const fg=new THREE.ExtrudeGeometry(fs,{depth:.8,bevelEnabled:false});for(const z of[2.6,-3.4])add(fg,wingM,0,8,z).rotation.x=z>0?-.22:.22;
  const ts=new THREE.Shape();ts.moveTo(-17,0);ts.lineTo(-23,9);ts.lineTo(-26,9);ts.lineTo(-25,0);ts.closePath();const tg=new THREE.ExtrudeGeometry(ts,{depth:.8,bevelEnabled:false});tg.rotateX(Math.PI/2);
  add(tg,wingM,0,6.4,3);add(tg,wingM,0,6.4,-3).scale.z=-1;
  for(const z of[3.6,-3.6])add(box(14,3.4,2.6),dark,8,6,z);
  add(new THREE.CylinderGeometry(3,3.4,3,12),dark,-25.5,7,0).rotation.z=Math.PI/2;
  for(const z of[11,-11])add(new THREE.CylinderGeometry(.7,.7,10,8),M.white,-2,4.8,z).rotation.z=Math.PI/2;
  ud.gear=new THREE.Group();for(const[x,z]of[[18,0],[-6,4],[-6,-4]]){const w=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,1,10),M.wheel);w.rotation.x=Math.PI/2;w.position.set(x,1.4,z);ud.gear.add(w);const st=new THREE.Mesh(box(.6,3,.6),dark);st.position.set(x,3.2,z);ud.gear.add(st)}body.add(ud.gear);
  ud.burner=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('rgba(255,150,60,1)'),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));ud.burner.position.set(-30,7,0);ud.burner.scale.set(8,8,1);body.add(ud.burner);
  return g}
const jetObjs=[],jetShadows=[];
function renderJets(dt){for(let k=0;k<jets.length;k++){const j=jets[k];if(!jetObjs[k]){jetObjs[k]=jetMesh();scene.add(jetObjs[k]);const sd=new THREE.Mesh(G.blob,M.shadow);sd.rotation.x=-Math.PI/2;scene.add(sd);jetShadows[k]=sd}
  const o=jetObjs[k],sd=jetShadows[k];o.visible=sd.visible=!j.dead&&!far(j.x,j.y,2600);if(!o.visible)continue;
  o.position.set(j.x,j.z,j.y);o.rotation.set(0,-j.a,0);o.userData.body.rotation.set(j.roll,0,j.pitch);o.userData.gear.visible=j.z<30;
  const bs=6+j.speed/40;o.userData.burner.scale.set(bs,bs,1);o.userData.burner.material.opacity=clamp(j.speed/300,.15,1);
  const g=heliGround(j.x,j.y),ss=Math.max(.15,1-(j.z-g)/700);sd.position.set(j.x,g+.6,j.y);sd.scale.set(34*ss,24*ss,1)}}
const meMesh=personMesh(myColor,'#e0b48f',true);scene.add(meMesh);let meColorNow=myColor;
const carMeshes=new Map(),pedMeshes=new Map(),remoteMeshes=new Map(),bulletMeshes=new Map(),cashMeshes=new Map(),spikeMeshes=new Map();
const spkMat=new THREE.MeshLambertMaterial({color:'#191921'}),spkTipMat=new THREE.MeshLambertMaterial({color:'#aab0c2'}),spkTip=new THREE.ConeGeometry(1.7,7,6);
function syncMap(map,list,make,update){
  const live=new Set(list);
  for(const[k,m]of map)if(!live.has(k)){scene.remove(m);map.delete(k)}
  for(const o of list){let m=map.get(o);if(!m){m=make(o);map.set(o,m);scene.add(m)}update(o,m)}
}
const far=(x,y,d)=>Math.abs(x-me.x)>d||Math.abs(y-me.y)>d;

// particles
const PMAX=900;
function pointsLayer(blending,size,opacity){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(PMAX*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(PMAX*3),3));
  const p=new THREE.Points(g,new THREE.PointsMaterial({size,map:glowTex('rgba(255,255,255,1)'),vertexColors:true,transparent:true,opacity,blending,depthWrite:false}));p.frustumCulled=false;scene.add(p);return p}
const glowPts=pointsLayer(THREE.AdditiveBlending,10,1),smokePts=pointsLayer(THREE.NormalBlending,26,.55);
const pc={};const pcol=s=>pc[s]||(pc[s]=new THREE.Color(s));
// flash lights
const flashes=[0,1,2].map(()=>{const l=new THREE.PointLight('#ffb86b',0,320,2);scene.add(l);return l});let flashI=0;
const headSpot=new THREE.SpotLight('#fff1d0',0,520,.55,.6,1);scene.add(headSpot,headSpot.target);

// camera state
const camPos=new THREE.Vector3(me.x,40,me.y+60);
const aimRay=new THREE.Raycaster(),ndcX=new THREE.Vector2(0,.08),ndc0=new THREE.Vector2(0,0);
function render(dt){
  dt=dt||1/60;
  if(meColorNow!==myColor){setShirt(meMesh,myColor);meColorNow=myColor}
  // cars
  syncMap(carMeshes,cars,c=>c.kind==='hill'?hillCarMesh(c.color):carMesh(c.color,c.type,c.mods),(c,m)=>{
    if(c.mods&&m.userData.mk!==modKey(c.color,c.mods)){scene.remove(m);m=carMesh(c.color,c.type,c.mods);carMeshes.set(c,m);scene.add(m)}
    m.visible=!far(c.x,c.y,1500);if(!m.visible)return;if(m.userData.detail)m.userData.detail.visible=!far(c.x,c.y,650);
    m.position.set(c.x,c.z||0,c.y);m.rotation.order='YZX';m.rotation.set(carRoll(c),-c.a,carPitch(c));const ud=m.userData;if(ud.brakes){const bm=c.kind==='mine'&&c.brk?brakeM:tailM;if(ud.brakes.material!==bm)ud.brakes.material=bm}if(ud.wheels){const gs=c.kind==='traffic'||c.kind==='police'&&c.mode!=='chase'?c.cur:(c.vx*Math.cos(c.a)+c.vy*Math.sin(c.a));if(!c.air)c.wsp=gs;const sp=c.air?c.wsp||0:gs;for(const w of ud.wheels)w.rotation.z-=sp*dt/4.5}
    if(c.kind==='dead'&&!ud.dead){ud.dead=true;ud.body.material=M.char;if(ud.cabin)ud.cabin.material=[M.char,M.char];ud.beam.visible=false;if(ud.l1){ud.l1.material=ud.l2.material=M.dim;ud.glow.visible=false}}
    if(!ud.dead){ud.beam.visible=c.kind!=='parked';if(ud.l1){const on=Math.sin(time*16+c.siren)>0;ud.l1.material=on?M.red:M.dim;ud.l2.material=on?M.dim:M.blue;ud.glow.material=on?M.redGlow:M.blueGlow}}
  });
  // peds
  syncMap(pedMeshes,peds,p=>{const m=personMesh(p.shirt,p.skin,!!(p.guard||p.gang),{fem:p.fem,hair:p.hair,skirt:p.fem&&p.skirt});if(p.vendor)m.add(cartMesh());return m},(p,m)=>{
    m.visible=!far(p.x,p.y,950);if(!m.visible)return;
    const u=m.userData,sc=p.fem?.95:1,lie=p.down||p.lie;
    m.position.set(p.x,groundZ(p.x,p.y)+(lie?2.5:0),p.y);m.rotation.set(lie?Math.PI/2:0,-p.a,0);m.scale.set(sc,sc*(p.crouch>0?.6:1),sc);
    if(!p.down)animPerson(m,p.ph,p.guard&&heist.alarm);
    u.gun.visible=!!(p.guard||p.gang||p.armed>0);
    if(p.hands>0)u.a1.rotation.z=u.a2.rotation.z=2.9;else if(p.calling>0||p.still&&p.kind==='phone')u.a2.rotation.z=2.4;
    const seen=p.bark&&Math.hypot(p.x-camera.position.x,p.y-camera.position.z)<260;
    if(seen){if(!u.bark){u.bark=barkSprite();m.add(u.bark)}const k=p.bark.s+p.bark.c;if(u.barkK!==k){u.barkK=k;u.bark.material.map=barkTex(p.bark.s,p.bark.c);u.bark.material.needsUpdate=true}}
    if(u.bark)u.bark.visible=!!seen;
  });
  // remote players
  const rl=[...remotes.entries()];
  syncMap(remoteMeshes,rl.map(e=>e[1]),r=>{const g=new THREE.Group();g.userData.p=personMesh(r.color,'#e0b48f',true);g.userData.lab=labelSprite();g.add(g.userData.p,g.userData.lab);return g},(r,g)=>{
    const ud=g.userData;g.visible=!r.dead;if(r.dead)return;if(ud.lk!==r.lk){ud.lk=r.lk;applyLook(ud.p,lookFrom(r.lk))}
    if(ud.color!==r.color){setShirt(ud.p,r.color);ud.color=r.color}
    if(r.inCar&&(!ud.car||ud.cc!==r.cc||ud.ct!==r.ct||ud.ng!==r.ng)){if(ud.car)g.remove(ud.car);ud.car=carMesh(r.cc,r.ct,r.ng?{neon:r.ng}:null);ud.cc=r.cc;ud.ct=r.ct;ud.ng=r.ng;g.add(ud.car)}
    if(r.inJet&&!ud.jet){ud.jet=jetMesh();g.add(ud.jet)}if(ud.jet){ud.jet.visible=r.inJet;ud.jet.rotation.y=-r.a}if(r.inHeli&&!ud.heli){ud.heli=heliMesh();g.add(ud.heli)}if(ud.heli){ud.heli.visible=r.inHeli;ud.heli.rotation.y=-r.a;ud.heli.userData.rotor.rotation.y=time*25;ud.heli.userData.trotor.rotation.z=time*40}if(ud.car)ud.car.visible=r.inCar;ud.p.visible=!r.inCar&&!r.inHeli&&!r.inJet;
    g.position.set(r.x,r.inCar?(r.cz||0):(r.z||0),r.y);ud.p.rotation.y=-r.a;if(ud.car)ud.car.rotation.y=-r.a;animPerson(ud.p,Math.hypot(r.tx-r.x,r.ty-r.y)>1?time*9:0,time-(r.shotT||-9)<1.2);
    ud.lab.position.y=r.inCar?32:28;drawLabel(ud.lab,r.name,r.color,r.hp);
  });
  // bullets
  syncMap(bulletMeshes,bullets,b=>{if(b.rocket){const g=new THREE.Group();g.add(new THREE.Mesh(G.rocket,M.rocket));const f=new THREE.Mesh(new THREE.PlaneGeometry(1,1),M.fire);f.scale.set(30,30,1);f.rotation.x=-Math.PI/2;f.position.x=-8;g.add(f);return g}return new THREE.Mesh(G.tracer,b.owner==='police'?M.ptracer:M.tracer)},
    (b,m)=>{m.position.set(b.x,b.z||12,b.y);m.rotation.y=-Math.atan2(b.vy,b.vx)});
  // cash
  syncMap(cashMeshes,pickups,p=>new THREE.Mesh(G.cash,p.powder?M.white:M.cash),(p,m)=>{m.position.set(p.x,groundZ(p.x,p.y)+4+Math.sin(time*4+p.x)*1.5,p.y);m.rotation.y=time*2});
  // roadblock spike strips
  syncMap(spikeMeshes,spikes,s=>{const g=new THREE.Group(),st=new THREE.Mesh(box(70,2,13),spkMat);st.position.y=1;g.add(st);
    for(let i=-3;i<=3;i++){const k=new THREE.Mesh(spkTip,spkTipMat);k.position.set(i*10,4.5,0);g.add(k)}return g},
    (s,m)=>{m.position.set(s.x,groundZ(s.x,s.y)+.3,s.y);m.rotation.y=-s.a});
  {const sg=new THREE.BoxGeometry(5,2.5,4);
   if(!render.sb){render.sb=[];render.sbMat=new THREE.MeshLambertMaterial({color:'#2a2833'});render.sbLed=new THREE.MeshBasicMaterial({color:'#ff2d2d'})}
   const all=stickies.map(b=>[b.x,b.z,b.y]);for(const r of remotes.values())for(const b of r.sb||[])all.push([b[0],b[2],b[1]]);
   while(render.sb.length<all.length){const g=new THREE.Group();g.add(new THREE.Mesh(sg,render.sbMat));const l=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.6,1.6),render.sbLed);l.position.y=1.8;g.add(l);g.userData.l=l;scene.add(g);render.sb.push(g)}
   render.sb.forEach((g,i)=>{const p=all[i];g.visible=!!p;if(p){g.position.set(p[0],p[1],p[2]);g.userData.l.visible=Math.sin(time*10)>0}})}
  renderJets(dt);
  // helicopter
  heliObj.visible=!!heli&&!heli.dead;heliShadow.visible=heliObj.visible;
  if(heli&&!heli.dead){heliObj.position.set(heli.x,heli.z,heli.y);heliObj.rotation.set(0,-heli.a,0);heliObj.userData.body.rotation.set(heli.roll,0,heli.tilt);heliObj.userData.rotor.rotation.y+=heli.spin*dt;heliObj.userData.trotor.rotation.z+=heli.spin*1.6*dt;
    const g=heliGround(heli.x,heli.y),alt=heli.z-g;heliShadow.position.set(heli.x,g+.6,heli.y);const ss=Math.max(.2,1-alt/500);heliShadow.scale.set(40*ss,22*ss,1);heliShadow.material.opacity=.42*ss}
  copHeliDraw(dt);
  // me
  meLookSync();meMesh.visible=!me.car&&!me.heli&&!me.jet&&state!=='dead'&&!(me.inv>0&&Math.floor(time*10)%2);
  meMesh.position.set(me.x,me.z||0,me.y);if(lap){meMesh.userData.l1.rotation.z=meMesh.userData.l2.rotation.z=1.45;meMesh.position.y=.5}meMesh.rotation.y=-me.a;animPerson(meMesh,Math.hypot(me.vx,me.vy)>5?time*11:0,time-lastFireT<1.2||scoped);{const ud=meMesh.userData;ud.a1.rotation.x=ud.a2.rotation.x=handsUp?Math.PI:0;if(handsUp)ud.a1.rotation.z=ud.a2.rotation.z=0}
  // job beacon
  const jv=job&&job.phase!=='wait'&&!job.noMarker&&!me.inside;beacon.visible=beaconRing.visible=!!jv;
  if(jv){const col=jobCol();beacon.material.color.set(col);beaconRing.material.color.set(col);beacon.position.set(job.x,80,job.y);beaconRing.position.set(job.x,1.8,job.y);beacon.material.opacity=.22+Math.sin(time*4)*.06}
  for(const r of shopRings)r.scale.setScalar(1+Math.sin(time*3)*.08);
  animInteriors(dt);
  // particles
  const gp=glowPts.geometry.attributes.position.array,gc=glowPts.geometry.attributes.color.array,sp=smokePts.geometry.attributes.position.array,sc=smokePts.geometry.attributes.color.array;let gn=0,sn=0;
  for(const p of parts){const t=p.life/p.max;
    if(p.k==='flash'){if(!p.lit){p.lit=true;const l=flashes[flashI++%3];l.position.set(p.x,18+(p.z0||0),p.y);l.intensity=p.sz>100?4:1.2;l.distance=p.sz>100?420:160;l.userData.decay=p.sz>100?3:14}continue}
    if(p.k==='smoke'){if(sn>=PMAX)continue;sp[sn*3]=p.x;sp[sn*3+1]=8+(1-t)*34+(p.z0||0);sp[sn*3+2]=p.y;const c=pcol(p.col);sc[sn*3]=c.r;sc[sn*3+1]=c.g;sc[sn*3+2]=c.b;sn++}
    else{if(gn>=PMAX)continue;gp[gn*3]=p.x;gp[gn*3+1]=p.k==='flare'?(p.z0||0)-(1-t)*90:(p.k==='fire'?6+(1-t)*22:3+t*12)+(p.z0||0);gp[gn*3+2]=p.y;const c=pcol(p.col);gc[gn*3]=c.r*t;gc[gn*3+1]=c.g*t;gc[gn*3+2]=c.b*t;gn++}}
  glowPts.geometry.setDrawRange(0,gn);smokePts.geometry.setDrawRange(0,sn);
  for(const L of[glowPts,smokePts]){L.geometry.attributes.position.needsUpdate=true;L.geometry.attributes.color.needsUpdate=true}
  for(const l of flashes)if(l.intensity>0)l.intensity=Math.max(0,l.intensity-dt*(l.userData.decay||5)*l.intensity-dt);
  // my headlights
  if(me.car&&me.car.kind!=='dead'){const c=me.car,fx=Math.cos(c.a),fy=Math.sin(c.a);headSpot.intensity=1.4;headSpot.position.set(c.x+fx*20,12,c.y+fy*20);headSpot.target.position.set(c.x+fx*140,0,c.y+fy*140)}else headSpot.intensity=0;
  // gps arrow
  {const show=job&&job.phase!=='wait'&&!job.noMarker&&!me.inside&&state==='play';gps.visible=!!show;
   if(show){const px=me.car?me.car.x:me.x,py=me.car?me.car.y:me.y,ang=Math.atan2(job.y-py,job.x-px);gpsMat.color.set(jobCol());
     gps.position.set(px,(me.car?ctOf(me.car).h+24:27)+Math.sin(time*3)*.8,py);gps.rotation.y=-ang;const sc=me.car?.95:.5;gps.scale.set(sc,sc,sc)}}
  {const t=lockTarget&&homePos(lockTarget);reticle.visible=!!t;if(t){reticle.position.set(t.x,((t.inHeli||t.inJet||lockTarget.air)?(t.z||0):0)+20,t.y);reticle.material.rotation=time*2}}
  // camera
  const inCar=!!me.car,tx=inCar?me.car.x:me.x,ty=inCar?me.car.y:me.y;
  if(inCar){if(time-look.offT>1.2)look.off*=Math.pow(.04,dt);const vel=Math.hypot(me.car.vx,me.car.vy),rev=(me.car.vx*Math.cos(me.car.a)+me.car.vy*Math.sin(me.car.a))<-40;
    look.yaw+=wrap(me.car.a+(rev?Math.PI:0)+look.off-look.yaw)*Math.min(1,dt*(3+vel/120))}
  const dist=inCar?96:me.jet?230:me.heli?150:(me.inside?42:54),baseH=inCar?30:me.jet?60:me.heli?34:(me.inside?24:22),pitch=me.inside?clamp(look.pitch,-.3,.55):inCar?clamp(look.pitch,-.1,.8):look.pitch;
  const fx=Math.cos(look.yaw),fy=Math.sin(look.yaw),rx=-fy,ry=fx,side=inCar||me.heli||me.jet?0:9;
  let k=1;for(let s=.2;s<=1.001;s+=.1){const px=tx-fx*dist*s+rx*side*s,py=ty-fy*dist*s+ry*side*s;if(solidAt(px,py,(me.car?me.car.z||0:me.z||0)+baseH)){k=Math.max(.18,s-.12);break}}
  const want=new THREE.Vector3(tx-fx*dist*Math.cos(pitch)*k+rx*side*k,(me.car?me.car.z||0:me.z||0)+Math.max(5,baseH+Math.sin(pitch)*dist*k),ty-fy*dist*Math.cos(pitch)*k+ry*side*k);
  want.y=Math.max(want.y,groundZ(want.x,want.z)+6);
  camPos.lerp(want,Math.min(1,dt*(inCar||me.heli||me.jet?7:14)));
  const sh=reduced?0:shake*.6;camera.position.set(camPos.x+(rand()-.5)*sh,camPos.y+(rand()-.5)*sh,camPos.z+(rand()-.5)*sh);
  camera.lookAt(tx+fx*30+rx*side*.6,inCar?16+(me.car.z||0):15+(me.z||0)-(pitch-.2)*55,ty+fy*30+ry*side*.6);
  if(drunk>0){drunk=Math.max(0,drunk-dt);const k2=Math.min(1.8,drunk/12);camera.rotation.z+=Math.sin(time*1.7)*.08*k2;camera.position.x+=Math.sin(time*1.1)*4*k2;camera.position.y+=Math.sin(time*.9)*2*k2}
  if(scoped){const hz=(me.z||0)+19;camera.position.set(me.x+fx*6,hz,me.y+fy*6);camera.lookAt(me.x+fx*300,hz-(look.pitch-.2)*200,me.y+fy*300);meMesh.visible=false}
  if(lap){camera.position.set(club.ox+398,24,club.oy+322);camera.lookAt(club.ox+386,14,club.oy+272)}
  const fov=scoped?16:62+(inCar?clamp(Math.hypot(me.car.vx,me.car.vy)/330,0,1)*14:0);if(Math.abs(camera.fov-fov)>.1){camera.fov+=(fov-camera.fov)*Math.min(1,dt*9);camera.updateProjectionMatrix()}
  aimPt=null;aimHit=false;
  if(state==='play'&&!inCar){camera.updateMatrixWorld();aimRay.setFromCamera(scoped?ndc0:ndcX,camera);const o=aimRay.ray.origin,dv=aimRay.ray.direction;
    const near=[];for(const c of cars)if(c!==me.car&&c.kind!=='dead'&&Math.abs(c.x-me.x)<1800&&Math.abs(c.y-me.y)<1800)near.push(c);
    const np=[];for(const p of peds)if(!p.down&&Math.abs(p.x-me.x)<1200&&Math.abs(p.y-me.y)<1200)np.push(p);
    for(let t=16;t<2600;t+=10){const x=o.x+dv.x*t,y=o.z+dv.z*t,z=o.y+dv.y*t;
      if(Math.hypot(x-me.x,y-me.y)<(me.jet?70:me.heli?44:12)&&z<(me.z||0)+(me.jet||me.heli?32:26)&&z>(me.z||0)-(me.jet||me.heli?24:4))continue;
      let hit=false;
      for(const r of remotes.values()){if(r.dead)continue;const rz=r.inCar?0:(r.z||0);if(Math.hypot(r.x-x,r.y-y)<(r.inCar?20:r.inHeli||r.inJet?30:11)&&z>rz-2&&z<rz+(r.inCar?24:26)){hit=true;break}}
      if(!hit)for(const c of near){if(z<ctOf(c).h+10&&Math.hypot(c.x-x,c.y-y)<ctOf(c).len/2){hit=true;break}}
      if(!hit)for(const p of np){if(z<22&&Math.hypot(p.x-x,p.y-y)<8){hit=true;break}}
      if(hit){aimPt=[x,y,z];aimHit=true;break}
      if(z<=0||solidAt(x,y,z)||(me.inside&&z>70)){aimPt=[x,y,Math.max(0,z)];break}}
    if(!aimPt)aimPt=[o.x+dv.x*2600,o.z+dv.z*2600,o.y+dv.y*2600]}
  $('xh').style.borderColor=aimHit?'#ff4b4b':'';
  $('xh').hidden=!(state==='play'&&!inCar)||scoped;
  const tg=performance.now();renderer.render(scene,camera);pf.gl=performance.now()-tg;
}

// minimap
const MS=4,MO=100,miniBig=document.createElement('canvas');miniBig.width=miniBig.height=Math.ceil((W+500)/MS);
{const g=miniBig.getContext('2d'),t=v=>(v+MO)/MS;
 g.fillStyle='#0b2a3d';g.fillRect(0,0,miniBig.width,miniBig.height);
 g.fillStyle='#9a8258';g.fillRect(t(-30),t(W-10),(W+60)/MS,310/MS);
 g.fillStyle='#5a5372';g.fillRect(t(0),t(0),W/MS,W/MS);
 const BC={airport:'#30333c',hood:'#3a2e28',park:'#1d5a36',lot:'#2a2735',beach:'#9a8258',suburb:'#2a5a38',industrial:'#3a3a42',city:'#26222f'};
 for(let bj=0;bj<N;bj++)for(let bi=0;bi<N;bi++){const x=bi*B+R,y=bj*B+R,sz=B-R;g.fillStyle='#3e3950';g.fillRect(t(x),t(y),sz/MS,sz/MS);g.fillStyle=BC[blockType[bj*N+bi]]||'#26222f';g.fillRect(t(x+SW),t(y+SW),(sz-2*SW)/MS,(sz-2*SW)/MS)}
 g.fillStyle='#262830';g.fillRect(t(8*B),t(0),(W-8*B)/MS,6*B/MS);g.fillStyle='#111216';g.fillRect(t(RWX-48),t(60),96/MS,(6*B-120)/MS);
 for(const p of parks)for(const[x,y,r]of p.trees){g.fillStyle='#2f8a4e';g.beginPath();g.arc(t(x),t(y),r/MS,0,TAU);g.fill()}
 for(const b of buildings){if(b.kind==='water'){g.fillStyle='#1d6a8a';g.beginPath();g.ellipse(t(b.x+b.w/2),t(b.y+b.h/2),(b.w+30)/2/MS,(b.h+30)/2/MS,0,0,TAU);g.fill();continue}
   g.fillStyle=b.kind==='house'?b.trim:b.kind==='container'?b.roof:shade(b.roof,1.25);g.fillRect(t(b.x),t(b.y),b.w/MS,b.h/MS)}
 for(const p of pools){g.fillStyle='#2bb8e6';g.fillRect(t(p.x),t(p.y),p.w/MS,p.h/MS)}
 for(const k of RAISED){const i=k%HM.gw,j=(k/HM.gw)|0,h=HM.a[k];g.fillStyle=`rgba(255,240,220,${Math.min(.4,h/120)})`;g.fillRect(t(HM.x0+i*HM.cell),t(HM.y0+j*HM.cell),HM.cell/MS+1,HM.cell/MS+1)} // raised ground reads lighter
g.fillStyle='#6a5040';g.fillRect(t(2077),t(W+300),46/MS,520/MS);
 g.strokeStyle='rgba(255,201,74,.35)';g.lineWidth=1;g.setLineDash([3,3]);g.beginPath();for(let k=0;k<=N;k++){g.moveTo(t(0),t(k*B+60));g.lineTo(t(W),t(k*B+60));g.moveTo(t(k*B+60),t(0));g.lineTo(t(k*B+60),t(W))}g.stroke();g.setLineDash([])}
const hillMini=buildHillMini(MS,MO);
const DOORICON={'Pink Flamingo':'D','Ink & Fade':'T','Iron Palms':'W','Palmetto PD':'P',"St. Palm's":'+','Pixel Palace':'A','Rusty Anchor':'R','Union Bank':'B','Gun shop':'G','Velvet Palms':'V','Snack & Go':'S','Safehouse':'H','Casino':'$'};
let miniSc=.35;
function drawMini(){
  const c=mctx,S=300,C=150,RIM=140;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,S,S);
  c.save();c.beginPath();c.arc(C,C,148,0,TAU);c.clip();c.fillStyle='#0b2a3d';c.fillRect(0,0,S,S);
  const cx=A.x,cy=A.y,heading=me.car?me.car.a:look.yaw,rot=-heading-Math.PI/2,cs=Math.cos(rot),sn=Math.sin(rot);
  const sp=me.car?Math.hypot(me.car.vx,me.car.vy):0,want=148/(me.car?520+sp*1.3:380);miniSc+=(want-miniSc)*.06;const sc=miniSc;
  c.translate(C,C);c.rotate(rot);c.scale(sc*MS,sc*MS);c.drawImage(miniBig,-(cx+MO)/MS,-(cy+MO)/MS);c.drawImage(hillMini,(hillMini.ox-cx)/MS,(hillMini.oy-cy)/MS);c.setTransform(1,0,0,1,0,0);
  const Pt=(x,y)=>{const dx=(x-cx)*sc,dy=(y-cy)*sc;return[C+dx*cs-dy*sn,C+dx*sn+dy*cs]};
  const edge=(x,y)=>{let[px,py]=Pt(x,y);const dx=px-C,dy=py-C,d=Math.hypot(dx,dy);if(d>RIM){px=C+dx/d*RIM;py=C+dy/d*RIM;return[px,py,true]}return[px,py,false]};
  const inView=(x,y)=>{const[px,py]=Pt(x,y);return Math.hypot(px-C,py-C)<RIM+6};
  // route line to the job
  if(job&&job.phase!=='wait'&&!job.noMarker&&!me.inside){const col=jobCol(),[jx,jy]=edge(job.x,job.y);c.strokeStyle=col;c.globalAlpha=.55;c.lineWidth=3;c.setLineDash([6,6]);c.beginPath();c.moveTo(C,C);c.lineTo(jx,jy);c.stroke();c.setLineDash([]);c.globalAlpha=1}
  // waypoint: GPS line along the road grid
  if(waypoint&&!me.inside){const rt=wpRouteC(A.x,A.y,waypoint.x,waypoint.y);c.strokeStyle='#29e6d6';c.globalAlpha=.85;c.lineWidth=3;c.setLineDash([5,5]);c.beginPath();c.moveTo(...Pt(A.x,A.y));rt.forEach(([x,y])=>c.lineTo(...Pt(x,y)));c.stroke();c.setLineDash([]);c.globalAlpha=1}
  // places
  c.font='700 13px "Chakra Petch",sans-serif';c.textAlign='center';c.textBaseline='middle';
  for(const l of LANDMARKS){const mx=l.x+l.w/2,my=l.y+l.h/2;if(!inView(mx,my))continue;const[px,py]=Pt(mx,my);c.fillStyle='#0b0814';c.beginPath();c.arc(px,py,9,0,TAU);c.fill();c.strokeStyle='#ffc94a';c.lineWidth=2;c.stroke();c.fillStyle='#ffc94a';c.fillText(l.ic,px,py+1)}
  for(const d of DOORS){if(!inView(d.x,d.y))continue;const[px,py]=Pt(d.x,d.y);c.fillStyle='#0b0814';c.beginPath();c.arc(px,py,10,0,TAU);c.fill();c.strokeStyle=d.col;c.lineWidth=2.5;c.stroke();c.fillStyle=d.col;c.fillText(DOORICON[d.label]||'?',px,py+1)}
  {const[px,py]=edge(GARAGE.x,GARAGE.y);c.fillStyle='#0b0814';c.beginPath();c.arc(px,py,10,0,TAU);c.fill();c.strokeStyle='#ff3ea5';c.lineWidth=2.5;c.stroke();c.fillStyle='#ff3ea5';c.fillText('C',px,py+1)}
  for(const b of ladders){if(!inView(b.ladder.x,b.ladder.base))continue;const[px,py]=Pt(b.ladder.x,b.ladder.base);c.fillStyle='#a7a1ba';c.fillRect(px-2,py-2,4,4)}
  // armored truck
  for(const v of cars)if(v.type==='armored'&&v.kind!=='dead'&&v!==me.car){const[px,py,e]=edge(v.x,v.y);c.fillStyle='#0b0814';c.fillRect(px-9,py-9,18,18);c.strokeStyle='#ffc94a';c.lineWidth=2.5;c.strokeRect(px-9,py-9,18,18);c.fillStyle='#ffc94a';c.fillText('A',px,py+1)}
  if(heli&&!heli.dead&&me.heli!==heli){const[px,py]=edge(heli.x,heli.y);c.fillStyle='#0b0814';c.beginPath();c.arc(px,py,10,0,TAU);c.fill();c.strokeStyle='#3dff7a';c.lineWidth=2.5;c.stroke();c.beginPath();c.moveTo(px-7,py-7);c.lineTo(px+7,py+7);c.moveTo(px+7,py-7);c.lineTo(px-7,py+7);c.stroke()}
  for(const j of jets)if(!j.dead&&me.jet!==j&&inView(j.x,j.y)){const[px,py]=Pt(j.x,j.y);c.save();c.translate(px,py);c.rotate(j.a+rot);c.fillStyle='#c9d4e6';c.strokeStyle='#0b0814';c.lineWidth=1.5;c.beginPath();c.moveTo(11,0);c.lineTo(-7,9);c.lineTo(-3,0);c.lineTo(-7,-9);c.closePath();c.fill();c.stroke();c.restore()}
  // cop search circle
  if(heat>0&&lastSeen){const[px,py]=Pt(lastSeen.x,lastSeen.y);c.fillStyle='rgba(74,163,255,.25)';c.beginPath();c.arc(px,py,(220+140*Math.ceil(heat-.001))*sc,0,TAU);c.fill()}
  // cops
  for(const v of cars)if(v.kind==='police'&&inView(v.x,v.y)){const[px,py]=Pt(v.x,v.y);c.fillStyle=Math.sin(time*12+v.siren)>0?'#ff2d55':'#2d6bff';c.beginPath();c.arc(px,py,6,0,TAU);c.fill()}
  for(const p of peds)if(p.gang&&!p.down&&inView(p.x,p.y)){const[px,py]=Pt(p.x,p.y);c.fillStyle=p.aggro?'#ff4b4b':p.gname==='Kings'?'#9a5ad8':'#3d9a4a';c.beginPath();c.arc(px,py,4.5,0,TAU);c.fill();c.strokeStyle='#0b0814';c.lineWidth=1.5;c.stroke()}
  // sticky bombs
  for(const b of stickies){if(!inView(b.x,b.y))continue;const[px,py]=Pt(b.x,b.y);c.fillStyle=Math.sin(time*10)>0?'#ff4b4b':'#5a1a1a';c.beginPath();c.arc(px,py,3.5,0,TAU);c.fill()}
  // job marker
  if(job&&job.phase!=='wait'&&!job.noMarker&&!me.inside){const col=jobCol(),[px,py,e]=edge(job.x,job.y);c.fillStyle=col;c.beginPath();c.arc(px,py,e?7:9,0,TAU);c.fill();c.strokeStyle='#0b0814';c.lineWidth=2;c.stroke()}
  // waypoint pin
  if(waypoint&&!me.inside){const[px,py,e]=edge(waypoint.x,waypoint.y);c.fillStyle='#29e6d6';c.beginPath();c.arc(px,py,e?6:8,0,TAU);c.fill();c.strokeStyle='#0b0814';c.lineWidth=2;c.stroke()}
  // friends
  for(const r of remotes.values()){if(r.dead)continue;const[px,py,e]=edge(r.x,r.y);c.save();c.translate(px,py);c.rotate(r.a+rot);c.fillStyle=r.color;c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.moveTo(9,0);c.lineTo(-6,6);c.lineTo(-6,-6);c.closePath();c.fill();c.stroke();c.restore()}
  // you
  c.save();c.translate(C,C);c.fillStyle='rgba(255,255,255,.12)';c.beginPath();c.moveTo(0,0);c.arc(0,0,60,-Math.PI/2-.45,-Math.PI/2+.45);c.closePath();c.fill();
  c.fillStyle='#fff';c.strokeStyle='#0b0814';c.lineWidth=2;c.beginPath();c.moveTo(0,-11);c.lineTo(8,8);c.lineTo(0,4);c.lineTo(-8,8);c.closePath();c.fill();c.stroke();c.restore();
  // north
  {const nx=-Math.sin(-rot)*0,v=[sn*-1,cs*-1],px=C+(-(-1)*sn)*RIM*0;const ang=rot-Math.PI/2,qx=C+Math.cos(ang)*(RIM-2),qy=C+Math.sin(ang)*(RIM-2);c.fillStyle='#0b0814';c.beginPath();c.arc(qx,qy,11,0,TAU);c.fill();c.fillStyle='#f3ecff';c.font='15px Bungee,Impact,sans-serif';c.fillText('N',qx,qy+1)}
  if(me.inside){c.fillStyle='rgba(10,8,20,.72)';c.fillRect(0,0,S,S);c.fillStyle='#f3ecff';c.font='22px Bungee,Impact,sans-serif';c.fillText('INDOORS',C,C-8);c.font='600 14px "Chakra Petch",sans-serif';c.fillStyle='#a69cc4';c.fillText(me.inside.name,C,C+18)}
  c.restore();
  c.strokeStyle='rgba(255,62,165,.7)';c.lineWidth=4;c.beginPath();c.arc(C,C,147,0,TAU);c.stroke();
}
// Palmetto Customs drive-in bay at GARAGE: a frame and sign over the lane (the car comes in from -y), a pink ground glow and a big spray can
{const gz=groundZ(GARAGE.x,GARAGE.y),pink=lam('#ff3ea5'),steel=lam('#2a2438');
  for(const x of[-17,17]){const p=new THREE.Mesh(box(3,26,3),steel);p.position.set(GARAGE.x+x,gz+13,GARAGE.y);scene.add(p)}
  const roof=new THREE.Mesh(box(37,4,3),steel);roof.position.set(GARAGE.x,gz+27,GARAGE.y);scene.add(roof);
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(64,16),new THREE.MeshBasicMaterial({map:signTex('Palmetto Customs','#ff3ea5')}));sg.position.set(GARAGE.x,gz+22,GARAGE.y-1.8);sg.rotation.y=Math.PI;scene.add(sg);
  const gl=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex(rgbaOf('#ff3ea5',.5))));gl.rotation.x=-Math.PI/2;gl.scale.set(110,110,1);gl.position.set(GARAGE.x,gz+1.7,GARAGE.y);scene.add(gl);
  const can=new THREE.Mesh(new THREE.CylinderGeometry(5,5,20,12),pink);can.position.set(GARAGE.x+27,gz+10,GARAGE.y);scene.add(can);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(2,2,4,8),steel);cap.position.set(GARAGE.x+27,gz+22,GARAGE.y);scene.add(cap);
}
// ---------- landmarks meshes ----------
// Built after the terrain meshes and before staticBatch. Static pieces merge per material; animated ones are instanced or kept apart.
function landmarkMeshes(){
  const lmm={};for(const k in LMC)lmm[k]=new THREE.MeshLambertMaterial({color:LMC[k]});
  lmm.water.emissive=new THREE.Color('#0a3346');
  for(const b of LMS){const cx=b.x+b.w/2,cz=b.y+b.h/2,m=new THREE.Mesh(new THREE.BoxGeometry(b.w,b.H,b.h),lmm[b.m]);m.position.set(cx,groundZ(cx,cz)+b.H/2,cz);scene.add(m)}
  // fountain: round basin, water disc, spout (the spray is animated in landmarkTick)
  const fx=1160,fy=2040,fg=groundZ(fx,fy);
  const basin=new THREE.Mesh(new THREE.CylinderGeometry(20,22,3.2,24),lmm.stone);basin.position.set(fx,fg+1.6,fy);scene.add(basin);
  const wat=new THREE.Mesh(new THREE.CylinderGeometry(17,17,.3,24),lmm.water);wat.position.set(fx,fg+2.4,fy);scene.add(wat);
  const spout=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.5,9,6),lmm.stone);spout.position.set(fx,fg+8,fy);scene.add(spout);
  LMA.spray=new THREE.InstancedMesh(new THREE.SphereGeometry(1.1,6,4),new THREE.MeshBasicMaterial({color:'#bfeaf5',transparent:true,opacity:.8}),8);scene.add(LMA.spray);
  // planters carry a tree each
  const pl=LMS.filter(b=>b.m==='planter'),tr=new THREE.InstancedMesh(new THREE.CylinderGeometry(.9,1.3,8,6),new THREE.MeshLambertMaterial({color:'#4a3426'}),Math.max(1,pl.length)),
    lf=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#2a7a4c',flatShading:true}),Math.max(1,pl.length));
  pl.forEach((b,i)=>{const x=b.x+b.w/2,y=b.y+b.h/2,g=groundZ(x,y);inst(tr,i,x,g+4+4,y,0);inst(lf,i,x,g+4+10,y,i,6,7,6)});tr.count=lf.count=pl.length;scene.add(tr,lf);
  // benches and lamps on the plaza walks, kept out of ramp landing zones
  const bench=mergeGeos([[new THREE.BoxGeometry(14,1.2,4.5),new THREE.Matrix4().makeTranslation(0,3.4,0)],[new THREE.BoxGeometry(14,5,.8),new THREE.Matrix4().makeTranslation(0,6,-2.2)],[new THREE.BoxGeometry(1,3,4),new THREE.Matrix4().makeTranslation(-5.5,1.5,0)],[new THREE.BoxGeometry(1,3,4),new THREE.Matrix4().makeTranslation(5.5,1.5,0)]]);
  const bl=[[1100,2000,0],[1220,2000,0],[1100,2090,Math.PI],[1220,2090,Math.PI]].filter(([x,y])=>!rampZone(x,y));
  const bm=new THREE.InstancedMesh(bench,new THREE.MeshLambertMaterial({color:'#5a4030'}),Math.max(1,bl.length));bl.forEach(([x,y,r],i)=>inst(bm,i,x,groundZ(x,y)+1.3,y,r));bm.count=bl.length;scene.add(bm);
  const lp=[[1040,2000],[1280,2000],[1040,2080],[1280,2080]].filter(([x,y])=>!rampZone(x,y)),lpo=new THREE.InstancedMesh(new THREE.CylinderGeometry(.5,.7,16,6),lmm.metal,Math.max(1,lp.length)),
    lhd=new THREE.InstancedMesh(new THREE.SphereGeometry(1.6,8,6),new THREE.MeshBasicMaterial({color:'#ffdf9e'}),Math.max(1,lp.length));
  lp.forEach(([x,y],i)=>{const g=groundZ(x,y);inst(lpo,i,x,g+8,y);inst(lhd,i,x,g+16.4,y)});lpo.count=lhd.count=lp.length;scene.add(lpo,lhd);
  // alleys: fire escape platforms and ladders on the alley side of the west half, a steam vent per alley
  {for(const a of ALLEYS){for(const fy of[18,36,54]){const pl=new THREE.Mesh(new THREE.BoxGeometry(2.5,.8,a.h*.5),lmm.metal);pl.position.set(a.x+1.25,fy,a.y+a.h*.5);scene.add(pl)}
    const ld=new THREE.Mesh(new THREE.BoxGeometry(.6,56,.6),lmm.metal);ld.position.set(a.x+3,28,a.y+a.h*.3);scene.add(ld);
    const vt=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.6,3,6),lmm.metal);vt.position.set(a.x+15,1.5,a.y+a.h*.7);scene.add(vt);
    const st=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('rgba(200,200,225,.35)'),transparent:true,depthWrite:false}));st.position.set(a.x+15,9,a.y+a.h*.7);st.scale.set(26,26,1);scene.add(st)}}
  // skate park: graffiti on the wall faces and two rails across the deck
  {const g1=new THREE.Mesh(new THREE.PlaneGeometry(64,16),graffMats[0]);g1.position.set(2140,groundZ(2140,3206)+5,3208.3);scene.add(g1);
   const g2=new THREE.Mesh(new THREE.PlaneGeometry(64,16),graffMats[2]);g2.rotation.y=Math.PI/2;g2.position.set(1888.3,groundZ(1888,3340)+5,3340);scene.add(g2);
   for(const[x,y,w,d]of[[2000,3440,30,1],[2000,3380,1,30]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,1,d),lmm.metal);m.position.set(x,groundZ(x,y)+6.5,y);scene.add(m)}}
  // marina: basin water, three moored boats (one shared bob in landmarkTick), containers, the crane is drawn by the cranes list
  const mw=new THREE.Mesh(new THREE.PlaneGeometry(126,304),lmm.water);mw.rotation.x=-Math.PI/2;mw.position.set(233,1.6,3800);scene.add(mw);
  const hull=mergeGeos([[new THREE.BoxGeometry(24,2.2,8),new THREE.Matrix4()],[new THREE.BoxGeometry(8,3,6),new THREE.Matrix4().makeTranslation(-3,2.4,0)]]),hm=new THREE.MeshLambertMaterial({color:'#e8e4f0'});
  LMA.boats=new THREE.InstancedMesh(hull,hm,3);LMA.boats.userData.pos=[[200,3720],[248,3840],[200,3910]];scene.add(LMA.boats);
  // the Pit: floodlight pylons with glow sprites, a pink ring on the floor
  const pyl=[[3218,3218],[3502,3218],[3218,3502],[3502,3502]];
  const pp=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.2,1.6,36,6),lmm.metal,pyl.length),ph=new THREE.InstancedMesh(new THREE.BoxGeometry(8,2.4,8),new THREE.MeshBasicMaterial({color:'#fff1c4'}),pyl.length);
  pyl.forEach(([x,y],i)=>{inst(pp,i,x,18,y);inst(ph,i,x,37,y)});pp.count=ph.count=pyl.length;scene.add(pp,ph);
  for(const[x,y]of pyl){const g=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('rgba(255,240,200,.8)'),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));g.position.set(x,38,y);g.scale.set(40,40,1);scene.add(g)}
  const ring=new THREE.Mesh(new THREE.RingGeometry(58,60,48),new THREE.MeshBasicMaterial({color:'#ff3ea5'}));ring.rotation.x=-Math.PI/2;ring.position.set(3360,1.4,3360);scene.add(ring);
  // pier: pilings under the deck, a rail along the boardwalk's sea edge, stall awnings
  const pg=[];for(let y=4584;y<4772;y+=24)for(const x of[2084,2116])pg.push([new THREE.CylinderGeometry(.9,1,9,5).translate(x,0,y),new THREE.Matrix4()]);scene.add(new THREE.Mesh(mergeGeos(pg),lmm.wood));
  const rg=[];for(let i=0;i<=W/30;i++){const x=i*30;rg.push([new THREE.BoxGeometry(.8,5,.8).translate(x,groundZ(x,4568)+2.5,4568),new THREE.Matrix4()])}scene.add(new THREE.Mesh(mergeGeos(rg),lmm.metal));
  const rail=new THREE.Mesh(new THREE.BoxGeometry(W,.7,.7),lmm.metal);rail.position.set(W/2,6.3,4568);scene.add(rail);
  const awm=new THREE.MeshLambertMaterial({color:'#ff3ea5'});LMS.filter(b=>b.m==='stall').forEach(b=>{const m=new THREE.Mesh(new THREE.BoxGeometry(b.w+4,1.2,b.h+6),awm);m.position.set(b.x+b.w/2,groundZ(b.x,b.y)+b.H+1,b.y+b.h/2);scene.add(m)});
  // roller-coaster frame east of the pier: towers and a track of boxes along a wave, merged into two meshes
  const trk=[],tow=[],cz=4650;let px=null;
  for(let i=0;i<=24;i++){const x=2280+i*15,h=groundZ(x,cz)+30+22*Math.abs(Math.sin(i*.5));
    if(i%4===0)tow.push([new THREE.BoxGeometry(2,h,2),new THREE.Matrix4().makeTranslation(x,h/2,cz)]);
    if(px){const dh=h-px[1],L=Math.hypot(15,dh),mid=new THREE.Matrix4().makeTranslation((px[0]+x)/2,(px[1]+h)/2,cz).multiply(new THREE.Matrix4().makeRotationZ(Math.atan2(dh,15)));trk.push([new THREE.BoxGeometry(L,1.4,1.4),mid])}
    px=[x,h]}
  scene.add(new THREE.Mesh(mergeGeos(trk),lmm.metal),new THREE.Mesh(mergeGeos(tow),lmm.metal));
}
// per-frame motion for landmarks: the fountain spray
function landmarkTick(){
  const bo=LMA.boats;if(bo){const p=bo.userData.pos;for(let i=0;i<p.length;i++)inst(bo,i,p[i][0],1.9+Math.sin(time*1.3+i*2)*.15,p[i][1],Math.sin(time*.9+i)*.03);bo.instanceMatrix.needsUpdate=true}
  const sp=LMA.spray;if(!sp)return;const fx=1160,fy=2040,fg=groundZ(fx,fy);
  for(let i=0;i<8;i++){const a=i/8*TAU+time*.6,r=7+Math.sin(time*3+i)*1.5,y=fg+6+(Math.sin(time*6+i*.9)+1)*2.2;inst(sp,i,fx+Math.cos(a)*r,y,fy+Math.sin(a)*r)}
  sp.instanceMatrix.needsUpdate=true;
}
// ---------- boot ----------
function seedWorld(){
  for(let i=0;i<24;i++)laneSpawn('traffic',120,1500);
  for(let i=0;i<45;i++){const[x,y]=pointAway(60,1300);spawnPed(x,y)}
for(const[x,y]of VENDORS){const p=spawnPed(x,y);p.kind='vendor';p.vendor=true;p.hx=x;p.hy=y}
  for(let i=0;i<10;i++){const[s]=parkSpot(40,1300);if(s)cars.push(mkCar(s[0],s[1],s[2],'parked',CARCOL[Math.floor(rand()*CARCOL.length)]))}
  cars.push(mkCar(4*B+R+40,4*B+108,0,'parked','#ff3ea5','sports'));
  newJob('courier');spawnGuards();
}
const SWATCH=['#ff3ea5','#29e6d6','#ffc94a','#7b6bff','#3dd68c','#ff6b3d','#4aa3ff','#f3ecff'];
function start(data){
  try{const n=localStorage.getItem('pr-name'),c=localStorage.getItem('pr-color');if(n)myName=n;if(c&&SWATCH.includes(c))myColor=c}catch(e){}
  try{const s=JSON.parse(localStorage.getItem('pr-settings')||'null');if(s&&typeof s==='object'){if(Number.isFinite(s.sens))settings.sens=clamp(s.sens,.3,3);if(typeof s.inv==='boolean')settings.inv=s.inv;if([0,4,8].includes(s.assist))settings.assist=s.assist}}catch(e){}
  try{loadArsenal(JSON.parse(localStorage.getItem('pr3d-arsenal')||'null'))}catch(e){}
  if(data&&typeof data.name==='string'){myName=data.name;myColor=hex(data.color,myColor);loadArsenal(data)}
  $('name').value=myName;
  const sw=$('swatches');
  SWATCH.forEach(c=>{const b=document.createElement('button');b.type='button';b.style.background=c;b.setAttribute('aria-label','Colour '+c);b.setAttribute('aria-pressed',String(c===myColor));
    b.onclick=()=>{myColor=c;sw.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))};sw.appendChild(b)});
  $('startForm').addEventListener('submit',e=>{e.preventDefault();
    myName=str($('name').value.trim())||'Nightrider';
    try{localStorage.setItem('pr-name',myName);localStorage.setItem('pr-color',myColor)}catch(_){}
    audioInit();lockMouse();$('start').hidden=true;$('name').blur();state='play';me.inv=2.5;
    if(isTouch)$('touch').hidden=false;
    if(!inClaude&&roomName!=='main')feed('Private city '+roomName.toUpperCase()+'. Only players with the link can join.');
  });
  // City panel: current room, join by code, copy the link. Claude keeps its single room.
  $('cityLine').textContent=inClaude?'Claude room':'City: '+roomName.toUpperCase()+(roomName==='main'?' \u00b7 public':'');
  $('cityPanel').hidden=inClaude;
  if(!inClaude){
    $('roomCode').value=roomName==='main'?'':roomName;
    const goRoom=r=>{myName=str($('name').value.trim())||myName;try{localStorage.setItem('pr-name',myName);localStorage.setItem('pr-color',myColor)}catch(e){};saveRoom(r);const q=new URLSearchParams(location.search);if(r==='main')q.delete('room');else q.set('room',r);location.search=q.toString()};
    const joinRoom=()=>goRoom(roomFrom('?room='+$('roomCode').value.trim()));
    $('roomJoin').onclick=joinRoom;
    $('roomCode').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();joinRoom()}});
    $('roomNew').onclick=()=>{const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c='';for(let i=0;i<6;i++)c+=A[Math.floor(rand()*32)];goRoom(c.toLowerCase())};
    $('roomPublic').onclick=()=>goRoom('main');
    $('roomCopy').onclick=()=>{const u=location.origin+location.pathname+(roomName==='main'?'':'?room='+roomName);
      const done=()=>{const b=$('roomCopy');b.textContent='Copied';setTimeout(()=>b.textContent='Copy link',1200)};
      const fallback=()=>{const t=document.createElement('textarea');t.value=u;t.style.cssText='position:fixed;opacity:0';document.body.appendChild(t);t.select();let yes=false;try{yes=document.execCommand('copy')}catch(e){}t.remove();if(yes)done();else{try{prompt('Copy this link',u)}catch(e){}}};
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(u).then(done,fallback);else fallback()};
  }
  terrainCheck();seedWorld();staticBatch();
  if(data&&data.playing){$('start').hidden=true;state='play';if(isTouch)$('touch').hidden=false}
  let last=performance.now();
  const loop=now=>{const raw=(now-last)/1000;let dt=clamp(raw,0,.033);last=now;perfTick(raw);if(wheelOpen)dt*=.25;
    try{const t0=performance.now();update(dt);const t1=performance.now();render(dt);const t2=performance.now();drawMini();const t3=performance.now();ui(dt);soundStep(dt);perfFrame(raw*1000,t1-t0,t3-t2,performance.now()-t3)}catch(err){console.error(err)}
    requestAnimationFrame(loop)};
  requestAnimationFrame(loop);
}
if(DBG)Object.defineProperties(DBG,{me:{get:()=>me},cars:{get:()=>cars},peds:{get:()=>peds},job:{get:()=>job},heat:{get:()=>heat},state:{get:()=>state},time:{get:()=>time},weap:{get:()=>weap},owned:{get:()=>owned},cash:{get:()=>me.cash},calls:{get:()=>renderer.info.render.calls}});
window.claude?.hot?.snapshot?.(()=>({name:myName,color:myColor,cash:me.cash,bonus10k:true,owned,ammo,weap,playing:state!=='menu'}));
window.claude?.hot?.ready?window.claude.hot.ready(start):start(window.claude?.hot?.data??{});
})();
