// ---------- update ----------
function update(dt){
  time+=dt;wxTick(dt);
  lockTarget=(state==='play'&&weap==='homing'&&!me.inside)?findLock():null;
  A.x=me.inside&&me.door?me.door.x:me.x;A.y=me.inside&&me.door?me.door.y:me.y;
  syncRoom(dt);tFrame(dt);crewFrame(dt);
  downedStep(dt);
  if(state==='dead'){specPick();deadT-=dt;if(deadT<=0)respawn()}
  me.inv=Math.max(0,me.inv-dt);me.fireCd-=dt;shopCd-=dt;
  if(state==='play'&&!me.downed&&!me.car&&!me.heli&&!me.jet&&!me.roof&&!me.climb&&shopCd<=0){
    if(me.inside){if(Math.hypot(me.inside.exit.x-me.x,me.inside.exit.y-me.y)<16)exitInt()}
    else for(const d of DOORS)if(Math.hypot(d.x-me.x,d.y-me.y)<18&&(!d.prop||d.prop.owned)){enterInt(d);break}}
  if(state==='play'){propStep();if(me.car&&!me.inside)propStore()}
  if(state==='play'&&time-me.lastHurt>7&&me.hp<BAL.playerHp)me.hp=Math.min(BAL.playerHp,me.hp+5*dt);
  const play=state==='play';
  lakeFall();pierFall();if(me.y<0)hillArrive();hillFog();
  // input vector
  let ix=(held('right')?1:0)-(held('left')?1:0),iy=(held('down')?1:0)-(held('up')?1:0);
  const shift=held('sprint'),hu=handsUp;
  if(sprintOn&&(!play||me.car||me.heli||me.jet||me.climb))sprintOn=sprintUsed=false;
  if(hu&&(ix||iy||held('shoot')||mouse.down||touchFire||stick.id!==null&&(stick.x||stick.y)))handsUp=false;
  aimAssist(dt);
  if(play&&!hu&&((held('shoot')&&!me.heli&&!me.jet)||mouse.down||touchFire))myShoot();
  heliStep(dt);jetStep(dt);fuelStep(dt);
  if(me.climb){const c=me.climb,L=c.b.ladder,top=c.b.H+1.6;c.t+=dt;const k=Math.min(1,c.t/c.dur);me.x=L.x;me.y=L.base-4;me.z=c.up?top*k:top*(1-k);me.a=-Math.PI/2;me.vx=me.vy=0;
    if(k>=1){if(c.up){me.roof=c.b;me.y=L.top;me.z=top}else{me.roof=null;me.y=L.base;me.z=0}me.climb=null}}
  if(play&&!me.car&&!me.climb&&!me.heli&&!me.jet){
    let f=-iy,rt=ix;if(stick.id!==null){f=-stick.y;rt=stick.x}
    if(hu){f=0;rt=0}
    const cf=Math.cos(look.yaw),sf=Math.sin(look.yaw);let mx=cf*f-sf*rt,my=sf*f+cf*rt;if(drunk>0&&(f||rt)){const k=Math.min(1,drunk/25);mx+=Math.sin(time*1.9)*.6*k;my+=Math.cos(time*1.4)*.6*k}
    const l=Math.hypot(mx,my),mv=l>.15;
    // toggle: clear the latched sprint once the player has been moving and then stops
    if(sprintOn){if(mv)sprintUsed=true;else if(sprintUsed)sprintOn=sprintUsed=false}
    const spr=(settings.sprintMode==='toggle'?sprintOn:shift)&&mv&&!stamOut&&!me.downed;
    const sp=(spr?205:135)*Math.min(1,l)*drugMul('move')*(me.downed?.35:1),k=Math.min(1,dt*(mv?14:30));
    me.vx+=((mv?mx/l*sp:0)-me.vx)*k;me.vy+=((mv?my/l*sp:0)-me.vy)*k;stamStep(spr,dt);
    me.x+=me.vx*dt;me.y+=me.vy*dt;if(me.roof&&roofAt(me.x,me.y)!==me.roof)me.roof=null;if(!me.roof)collide(me,me.x,me.y,8);footStep(dt);
    if(time-lastFireT<.6||(document.pointerLockElement===cv&&l<.15))me.a+=wrap(look.yaw-me.a)*Math.min(1,dt*18);
    else if(l>.15)me.a+=wrap(Math.atan2(my,mx)-me.a)*Math.min(1,dt*12);
    // busted: slow cops right next to you
    let near=false;for(const c of cars)if(c.kind==='police'&&heat>0&&Math.hypot(c.x-me.x,c.y-me.y)<60&&Math.hypot(c.vx,c.vy)<70)near=true;
    me.bustT=near&&!me.roof?me.bustT+dt:Math.max(0,me.bustT-dt);if(me.bustT>2.6)die('BUSTED');handsStep(dt);
    for(const[peer,r]of remotes){if(r.dead||!r.inCar)continue;const d=Math.hypot(r.x-me.x,r.y-me.y);if(d<22){const nx=(me.x-r.x)/(d||1),ny=(me.y-r.y)/(d||1);me.x+=nx*(22-d);me.y+=ny*(22-d)}}
  }
  modNitroStep(dt);pitTick(dt);
  // cars
  for(const c of cars){
    if(c.air&&c.kind!=='mine')c.air=false;if(!c.air)c.z=groundZ(c.x,c.y);
    if(c.kind==='mine'){
      let thr=-iy,st=ix,hand=shift;
      if(stick.id!==null){thr=Math.abs(stick.y)>.2?-stick.y:0;st=Math.abs(stick.x)>.15?stick.x:0}
      if(drunk>0){const k=Math.min(1,drunk/25);st=clamp(st+(Math.sin(time*1.3)*.55+Math.sin(time*3.7)*.3)*k,-1,1);if(rand()<dt*k*.8)thr*=.2}
      if(c.burn||!play){thr=0;st=0}
      drive(c,thr,st,hand,dt);
      const imp=carWalls(c);if(imp>90){damageCar(c,Math.min(BAL.crashMax,(imp-90)*.12)*drugMul('crash'),true);thud(imp);shake=Math.max(shake,imp/60);burst(c.x+Math.cos(c.a)*20,c.y+Math.sin(c.a)*20,6,'#ffd27a',160,.3)}
      carZ(c,dt);me.x=c.x;me.y=c.y;me.a=c.a;me.z=c.z;
      const sp=Math.hypot(c.vx,c.vy);
      for(const p of peds){if(p.down)continue;if(Math.hypot(p.x-c.x,p.y-c.y)<16&&sp>55)knockPed(p,c.vx*1.1,c.vy*1.1,true)}
      for(const[peer,r]of remotes){if(r.dead)continue;const d=Math.hypot(r.x-c.x,r.y-c.y);
        if(r.inCar&&d<26){const nx=(c.x-r.x)/(d||1),ny=(c.y-r.y)/(d||1);c.x+=nx*(26-d);c.y+=ny*(26-d);const vn=c.vx*nx+c.vy*ny;if(vn<0){c.vx-=1.2*vn*nx;c.vy-=1.2*vn*ny;if(-vn>120&&!(r.ramT>time)){r.ramT=time+.6;if(RULES.ff)dmgOut[peer]=(dmgOut[peer]||0)+Math.min(BAL.crashMax,Math.round(-vn*.06))}}}
        else if(!r.inCar&&!(r.z>5)&&d<20&&sp>110&&!(r.ramT>time)){r.ramT=time+.6;if(RULES.ff)dmgOut[peer]=(dmgOut[peer]||0)+Math.min(BAL.crashMax,Math.round(30+sp*.1))}}
    }
    else if(c.kind==='traffic'){
      const fx=Math.cos(c.d*Math.PI/2),fy=Math.sin(c.d*Math.PI/2);let blocked=false;
      if(c.ghost>0)c.ghost-=dt;else{
        const chk=(ox,oy,w)=>{const dx=ox-c.x,dy=oy-c.y,al=dx*fx+dy*fy;if(al>0&&al<72&&Math.abs(dx*fy-dy*fx)<w)blocked=true};
        for(const o of cars)if(o!==c&&o.kind!=='dead')chk(o.x,o.y,20);
        chk(me.x,me.y,me.car?22:14);for(const r of remotes.values())if(!r.dead)chk(r.x,r.y,18);
      }
      c.blockT=blocked?c.blockT+dt:0;if(c.blockT>3.5){c.ghost=1.6;c.blockT=0}
      c.cur+=((blocked?0:c.spd)-c.cur)*Math.min(1,(blocked?6:1.5)*dt);
      laneMove(c,dt,!!c.rv);
    }
    else if(c.kind==='hill'){if(hillCarFar(c)&&(hillFrame&1))continue;hillCarStep(c,dt*(hillCarFar(c)?2:1))}
    else if(c.kind==='police')copStep(c,dt);
    else if(c.kind==='parked'||c.kind==='dead'){
      if(c.vx||c.vy){drive(c,0,0,true,dt);carWalls(c);if(Math.hypot(c.vx,c.vy)<2)c.vx=c.vy=0}
    }
    if(Math.hypot(c.vx,c.vy)>60)exhaust(c,dt);
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
  pedsStep(dt);eventStep(dt);
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
  stickyStep(dt);robStep(dt);heistStep(dt);drugStep(dt);revStep(dt);trafficStep(dt);if(lap){lap.t+=dt;if(lap.t>=lap.dur)endLap()}
  if(scoped&&(weap!=='sniper'||me.car||me.heli||me.jet||state!=='play'||me.climb||me.downed))scoped=false;
  // pickups
  for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.t-=dt;if(play&&Math.hypot(p.x-me.x,p.y-me.y)<22){me.cash+=p.amt;noise(.08,7000,.12);pickups.splice(i,1);continue}if(p.t<=0)pickups.splice(i,1)}
  // particles
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.15,dt);p.vy*=Math.pow(.15,dt);if(p.life<=0)parts.splice(i,1)}
  if(parts.length>700)parts.splice(0,parts.length-700);
  // heat / police population. With cops off no heat sticks and the step spawns nothing.
  if(!RULES.cops)heat=0;
  policeStep(dt);
  if(!cars.some(c=>c.type==='armored'&&c.kind!=='dead')){armorWait+=dt;if(armorWait>45){const[sp]=parkSpot(600,2600);if(sp){armorWait=0;cars.push(mkCar(sp[0],sp[1],sp[2],'parked','#4a5a4c','armored'));feed('An armored truck was spotted. Find the gold square on the map')}}}
  // traffic, peds and parked cars: the host's traffic rule picks the cap and the spawn rate scales with it
  const tCap=HRCAP.traffic[RULES.traffic],pCap=HRCAP.peds[RULES.traffic],kCap=HRCAP.parked[RULES.traffic];
  let traffic=0;for(const c of cars)if(c.kind==='traffic')traffic++;
  if(traffic<tCap&&rand()<dt*4*tCap/26)laneSpawn('traffic',560,1500);
  hillTraffic(dt);hikerStep(dt);
  if(peds.length<pCap&&rand()<dt*6*pCap/44)spawnPed();gangPop(dt);
  let parked=0;for(const c of cars)if(c.kind==='parked')parked++;
  if(parked<kCap&&rand()<dt*2*kCap/10){const[sp]=parkSpot(560,1500);if(sp)cars.push(mkCar(sp[0],sp[1],sp[2],'parked',CARCOL[Math.floor(rand()*CARCOL.length)]))}
  if(play)jobStep(dt),careerStep(dt);
  raceStep(dt);
  publish(dt);
  shake*=Math.pow(.02,dt);
}
function laneMove(c,dt,greedy){
  const sg=POS(c.d)?1:-1,a=along(c)+sg*c.cur*dt;
  // keep vx/vy in step with the lane motion, so collisions and exhaust see a moving car
  if(c.d%2===0){c.vx=0;c.vy=c.cur*sg}else{c.vx=c.cur*sg;c.vy=0}
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
    const d=Math.hypot(x-A.x,y-A.y);if(d<min||d>max||inAF(x,y))continue;
    let free=true;for(const c of cars)if(Math.hypot(c.x-x,c.y-y)<40)free=false;if(!free)continue;
    return[[x,y,a]];
  }
  return[null];
}

