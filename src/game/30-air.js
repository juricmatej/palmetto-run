// ---------- attack helicopter ----------
const PAD={x:3*B+R+160,y:1*B+R+160};
let heliRocketCd=0;
if(DBG)Object.defineProperties(DBG,{heli:{get:()=>heli},PAD:{get:()=>PAD}});
function spawnHeli(){heli={x:PAD.x,y:PAD.y,z:0,a:-Math.PI/2,vx:0,vy:0,vz:0,hp:BAL.heliHp,falling:false,dead:false,tilt:0,roll:0,spin:0}}
function heliGround(x,y){let g=groundZ(x,y);nearB(x,y,b=>{if(b.kind!=='water'&&x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h)g=Math.max(g,(b.H||0)+(b.kind==='house'?16:1.6))});return g}
function roofAt(x,y){let r=null;nearB(x,y,b=>{if(b.kind!=='water'&&b.kind!=='house'&&b.kind!=='fence'&&x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h)r=b});return r}
function heliStep(dt){
  flareCd=Math.max(0,flareCd-dt);heliRocketCd=Math.max(0,heliRocketCd-dt);
  if(!heli){spawnHeli();return}
  const h=heli,mine=me.heli===h;
  if(h.dead){heliWait+=dt;if(heliWait>30){heliWait=0;spawnHeli();feed('A new attack helicopter landed at the Lagoon Park helipad')}return}
  const g0=heliGround(h.x,h.y);
  if(h.falling){h.vz-=320*dt;h.a+=dt*5;h.x+=h.vx*dt;h.y+=h.vy*dt;h.z+=h.vz*dt;h.spin=20;if(h.z<=g0){h.z=g0;h.dead=true;explode(h.x,h.y,mine,false,g0);explode(h.x+20,h.y,mine,false,g0);if(mine){me.heli=null;me.z=0;me.roof=null;die('WASTED')}}return}
  if(h.hp<=0){h.falling=true;if(mine)feed('Mayday! The helicopter is going down');return}
  let f=0,rt=0,up=0;
  if(mine&&state==='play'){f=(held('up')?1:0)-(held('down')?1:0);rt=(held('right')?1:0)-(held('left')?1:0);
    if(stick.id!==null){f=-stick.y;rt=stick.x}up=(held('shoot')||heliUpT?1:0)-(held('sprint')||heliDnT?1:0);
    h.a+=wrap(look.yaw-h.a)*Math.min(1,dt*3)}
  if(mine&&fuelState.u<1){f=rt=0;up=-1}
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
    if(mine&&state==='play'){thr=(held('up')?1:0)-(held('down')?1:0);if(stick.id!==null)thr=-stick.y;climb=(held('shoot')||heliUpT?1:0)-(held('sprint')||heliDnT?1:0);
      const rate=air?1.15:(j.speed<80?1.4:.8),diff=wrap(look.yaw-j.a);j.a+=clamp(diff,-rate*dt,rate*dt);j.roll+=((air?clamp(diff*1.4,-1.1,1.1):0)-j.roll)*Math.min(1,dt*3)}
    else j.roll*=Math.pow(.1,dt);
    if(mine&&fuelState.u<1){thr=0;climb=-1}
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
const DEALER={x:6*B+R+10,y:5*B+R+10};let drugs={coke:0,speed:0,calm:0},drugSel=0,drugState={k:null,t:0},drugHist=[],odT=0;
const DK=['coke','speed','calm'],DRUGS={coke:{name:'Coke',price:300,t:25,col:'#f3ecff',fx:{heat:1.2}},speed:{name:'Speed',price:200,t:30,col:'#29e6d6',fx:{move:1.35,spread:1.3,crash:1.25}},calm:{name:'Calm',price:150,t:40,col:'#3dd68c',fx:{hurt:.8}}};
const nearDealer=()=>!me.car&&!me.heli&&!me.jet&&!me.inside&&!me.roof&&Math.hypot(DEALER.x-me.x,DEALER.y-me.y)<30;
function buyDrug(){const k=DK[drugSel],d=DRUGS[k];if(me.cash<d.price){feed(`${d.name} costs $${d.price}`);return}if(drugs[k]>=3){feed(`You already carry three ${d.name}`);return}me.cash-=d.price;drugs[k]++;feed(`Bought ${d.name} (${drugs[k]}). ${kb('drugSwitch')} switches, ${kb('drug')} uses`);noise(.1,5000,.12);saveArsenal()}

// ---------- robberies ----------
function startRob(p){if(rob)return;if(p.act==='heist'&&!unlocked('casinoHeist')){feed(`Come back at level ${UNLOCK.casinoHeist}`);return}const id=p.act+p.x;if((robCd[id]||0)>time){feed(`Nothing left to take. Come back in ${Math.ceil(robCd[id]-time)}s`);return}
  const big=p.act==='heist';rob={p,id,t:0,dur:big?12:6,cash:Math.round(big?rr(4000,6500):rr(700,1500)),heat:big?4:2};
  feed(big?'Heist started! Stay by the cage':'Robbery! Stay by the register');noise(.35,1500,.25)}
function robStep(dt){if(!rob)return;
  if(state!=='play'||!me.inside||Math.hypot(rob.p.x-me.x,rob.p.y-me.y)>60){feed('Robbery aborted');rob=null;return}
  rob.t+=dt;if(rob.t>=rob.dur){me.cash+=rob.cash;heat=Math.max(heat,rob.heat);coolT=0;robCd[rob.id]=time+180;showBig(rob.dur>8?'HEIST COMPLETE':'STORE ROBBED','#3dd68c',`+$${rob.cash}. The cops are on the way`,2.2);noise(.4,6000,.25);gainXP(rob.dur>8?250:80,rob.dur>8?'Casino cage':'Store robbery');saveArsenal();rob=null}}

// ---------- sticky bombs ----------
const stickies=[];let exSeq=0,lastEx=null;
function throwSticky(){if(stickies.length>=5){feed(`Five bombs are out. Press ${kb('detonate')} to detonate`);return false}
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
function detonate(){if(!stickies.length||state!=='play'||me.downed)return;const pts=[];for(const b of stickies){explode(b.x,b.y,true,false,Math.max(groundZ(b.x,b.y),b.z),1,b.stuck);pts.push(Math.round(b.x),Math.round(b.y))}stickies.length=0;exSeq++;lastEx=[exSeq,...pts]}

