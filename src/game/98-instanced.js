// ---------- instanced civilians and ambient cars ----------
// Civilians (not gangs, guards, cops or vendors) and ambient cars (traffic and parked, not the player's, not personal, no mods)
// draw as InstancedMeshes: one per body part and outfit, one per part and car type. Only instances in view get a matrix each frame.
// ponytail: 128 entities per part (256 for paired legs, arms and wheels). Past that a frame draws the first 128 only, add a bigger cap when needed.
const ICAP=128,_m=new THREE.Matrix4(),_ax=new THREE.Matrix4(),_cm=new THREE.Matrix4(),_A=[new THREE.Matrix4(),new THREE.Matrix4()];
const _fr=new THREE.Frustum(),_pv=new THREE.Matrix4(),_sp=new THREE.Sphere(),_eu=new THREE.Euler(),_ld=new THREE.Object3D(),_rd=new THREE.Object3D();
// colour starts white, so an instance nobody colours keeps the material's own colour
const instMesh=(geo,mat,k=1)=>{const m=new THREE.InstancedMesh(geo,mat,ICAP*k);m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(ICAP*k*3).fill(1),3);m.frustumCulled=false;m.visible=false;scene.add(m);return m};
const flushI=(m,n)=>{if(!m)return;m.count=Math.min(n,m.instanceMatrix.count);m.visible=n>0;if(n){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}};
const civ=p=>!(p.gang||p.guard||p.cop||p.vendor),ambient=c=>(c.kind==='traffic'||c.kind==='parked')&&c!==me.car&&!c.personal&&!c.mods;
const paintI=paint('#ffffff'),tailI=new THREE.MeshBasicMaterial({color:'#ffffff'}),wlam=lam('#ffffff'); // white base, colour per instance
// writes local pose k of an instanced part on top of the root matrix
function lpose(mesh,k,root,x,y,z,rx=0,rz=0,sx=1,sy=1,sz=1){_ld.position.set(x,y,z);_ld.rotation.set(rx,0,rz);_ld.scale.set(sx,sy,sz);_ld.updateMatrix();mesh.setMatrixAt(k,_m.multiplyMatrices(root,_ld.matrix))}
// outfit 0 male, 1 female. Legs and arms pivot at the hip and shoulder, so their geometry is moved down to the pivot.
const PEDI=[0,1].map(f=>({n:0,sk:0,gn:0,legs:instMesh((f?PG2.fleg:G.leg).clone().translate(0,-4,0),M.black,2),arms:instMesh(PG2.arm.clone().translate(0,-4,0),wlam,2),
  torso:instMesh(f?PG2.ftorso:PG2.mtorso,wlam),head:instMesh(G.head,wlam),cap:instMesh(f?PG2.fcap:PG2.mcap,wlam),tail:f?instMesh(PG2.ftail,wlam):null,skirt:f?instMesh(PG2.skirt,wlam):null,gun:instMesh(G.gun,M.gun),shadow:instMesh(G.blob,M.shadow)}));
function instCivs(){
  for(const O of PEDI)O.n=O.sk=O.gn=0;
  for(const p of peds){
    if(!civ(p)||far(p.x,p.y,950))continue;
    const g=groundZ(p.x,p.y);_sp.center.set(p.x,g+12,p.y);_sp.radius=30;if(!_fr.intersectsSphere(_sp))continue;
    const fem=!!p.fem,O=PEDI[fem?1:0];if(O.n>=ICAP)continue;const i=O.n++,sc=fem?.95:1,lie=p.down||p.lie,s=Math.sin(p.ph)*.6,h=p.hands>0,ca=p.calling>0||(p.still&&p.kind==='phone'),hs=fem?.94:1;
    _rd.position.set(p.x,g+(lie?2.5:0),p.y);_rd.rotation.set(lie?Math.PI/2:0,-p.a,0);_rd.scale.set(sc,sc*(p.crouch>0?.6:1),sc);_rd.updateMatrix();
    const R=_rd.matrix;
    lpose(O.legs,2*i,R,0,8,fem?1.5:2,0,s);lpose(O.legs,2*i+1,R,0,8,fem?-1.5:-2,0,-s);
    lpose(O.arms,2*i,R,0,15,-4.2,0,h?2.9:s*.5);lpose(O.arms,2*i+1,R,0,15,4.2,0,h?2.9:ca?2.4:-s*.5);
    lpose(O.torso,i,R,0,12,0);lpose(O.head,i,R,0,18.6,0,0,0,hs,hs,hs);lpose(O.cap,i,R,0,fem?21.1:21.4,0);lpose(O.shadow,i,R,0,.4,0,-Math.PI/2,0,6,6,1);
    O.arms.setColorAt(2*i,pcol(p.shirt));O.arms.setColorAt(2*i+1,pcol(p.shirt));O.torso.setColorAt(i,pcol(p.shirt));O.head.setColorAt(i,pcol(p.skin));O.cap.setColorAt(i,pcol(p.hair));
    if(fem){lpose(O.tail,i,R,-2.3,17.2,0);O.tail.setColorAt(i,pcol(p.hair))}
    if(fem&&p.skirt){const k=O.sk++;lpose(O.skirt,k,R,0,6.4,0);O.skirt.setColorAt(k,pcol(p.skirt))}
    if(p.armed>0){lpose(O.gun,O.gn++,R,6,12,3.5)}
  }
  for(const O of PEDI){flushI(O.legs,2*O.n);flushI(O.arms,2*O.n);flushI(O.torso,O.n);flushI(O.head,O.n);flushI(O.cap,O.n);flushI(O.tail,O.n);flushI(O.skirt,O.sk);flushI(O.gun,O.gn);flushI(O.shadow,O.n)}
}
// one car type: each static part merged per material, the wheels as one pair per axle, and the local shadow and beam
const AMB={};
function ambType(type){
  const P=carMesh('#ffffff',type),ud=P.userData,C=carGeo(type),wh=new Set(ud.wheels),cg=C.cabin,ix=cg.index.array,r=cg.groups[0].count,k={},T={n:0,dn:0,st:[],ax:[C.L*.31,-C.L*.31],wr:C.wr};
  const cab=(a,b)=>{const q=new THREE.BufferGeometry();q.setAttribute('position',cg.attributes.position);q.setAttribute('normal',cg.attributes.normal);q.setIndex(new THREE.BufferAttribute(ix.slice(a,b),1));return q};
  const put=(key,mat,geo,mx,det,axle)=>{(k[key]||(k[key]={mat,det,axle,list:[]})).list.push([geo,mx])};
  P.updateMatrixWorld(true);
  // (wheel pairs are built from the front axle: both sides, offset along z)
  P.traverse(o=>{
    if(!o.isMesh)return;
    const mt=o.material,mx=o.matrixWorld.clone(),det=o.parent===ud.detail;
    if(mt===M.shadow){T.sh=mx;return}
    if(mt===M.beam){T.be=mx;return}
    if(wh.has(o.parent)){if(o.parent.position.x>0)put('w'+mt.uuid,mt,o.geometry,new THREE.Matrix4().makeTranslation(0,0,o.parent.position.z),true,true);return}
    if(Array.isArray(mt)){put('paint',paintI,cab(0,r),mx,false,false);put(glassM.uuid,glassM,cab(r,ix.length),mx,false,false);return}
    put((det?'d':'')+(mt===paintI?'paint':mt.uuid),mt,o.geometry,mx,det,false);
  });
  T.st=Object.values(k).map(e=>({mesh:instMesh(mergeGeos(e.list),e.mat===tailM?tailI:e.mat,e.axle?2:1),det:e.det,axle:e.axle,col:e.mat===paintI?'paint':e.mat===tailM?'tail':''}));
  return AMB[type]=T;
}
let SHD=null,BEAM=null;
function instCars(dt){
  camera.updateMatrixWorld();_pv.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);_fr.setFromProjectionMatrix(_pv);
  if(!SHD){SHD=instMesh(G.blob,M.shadow);BEAM=instMesh(new THREE.PlaneGeometry(1,1),M.beam)}
  for(const T of Object.values(AMB))T.n=T.dn=0;
  let s=0,b=0;
  for(const c of cars){
    if(!ambient(c)||far(c.x,c.y,1500))continue;
    const T=AMB[c.type]||ambType(c.type),gs=c.kind==='traffic'?c.cur:c.vx*Math.cos(c.a)+c.vy*Math.sin(c.a);
    c.spin=(c.spin||0)-gs*dt/4.5; // wheels turn as they do on a car mesh, in range or not
    _sp.center.set(c.x,(c.z||0)+8,c.y);_sp.radius=90;if(!_fr.intersectsSphere(_sp)||s>=ICAP)continue;
    const i=T.n++,lod=far(c.x,c.y,650),j=lod?-1:T.dn++;
    _eu.set(carRoll(c),-c.a,carPitch(c),'YZX');_cm.makeRotationFromEuler(_eu);_cm.setPosition(c.x,c.z||0,c.y);
    if(!lod)for(let a=0;a<2;a++){_ax.makeRotationZ(c.spin);_ax.setPosition(T.ax[a],T.wr,0);_A[a].multiplyMatrices(_cm,_ax)}
    for(const q of T.st){
      const m=q.mesh,n=q.det?j:i;
      if(q.det&&lod)continue;
      if(q.axle)for(let a=0;a<2;a++)m.setMatrixAt(2*j+a,_A[a]);
      else m.setMatrixAt(n,_cm);
      if(q.col==='paint')m.setColorAt(n,pcol(c.color||'#ffffff'));else if(q.col==='tail')m.setColorAt(n,c.brk?brakeM.color:tailM.color);
    }
    _m.multiplyMatrices(_cm,T.sh);SHD.setMatrixAt(s++,_m);
    if(c.kind!=='parked'){_m.multiplyMatrices(_cm,T.be);BEAM.setMatrixAt(b++,_m)}
  }
  for(const T of Object.values(AMB))for(const q of T.st)flushI(q.mesh,q.axle?2*T.dn:q.det?T.dn:T.n);
  flushI(SHD,s);flushI(BEAM,b);
}
function render(dt){
  dt=dt||1/60;
  if(meColorNow!==myColor){setShirt(meMesh,myColor);meColorNow=myColor}
  // cars
  syncMap(carMeshes,cars.filter(c=>!ambient(c)),c=>c.kind==='hill'?hillCarMesh(c.color):carMesh(c.color,c.type,c.mods),(c,m)=>{
    if(c.mods&&m.userData.mk!==modKey(c.color,c.mods)){scene.remove(m);m=carMesh(c.color,c.type,c.mods);carMeshes.set(c,m);scene.add(m)}
    m.visible=!far(c.x,c.y,1500);if(!m.visible)return;if(m.userData.detail)m.userData.detail.visible=!far(c.x,c.y,650);
    m.position.set(c.x,c.z||0,c.y);m.rotation.order='YZX';m.rotation.set(carRoll(c),-c.a,carPitch(c));const ud=m.userData;if(c.personal&&!ud.plate){const C=carGeo(c.type);ud.plate=new THREE.Mesh(box(.4,2.2,4.6),M.blue);ud.plate.position.set(-C.L/2-.3,C.P.base+2.5,0);m.add(ud.plate)}if(ud.brakes){const bm=c.brk?brakeM:tailM;if(ud.brakes.material!==bm)ud.brakes.material=bm}if(ud.wheels){const gs=c.kind==='traffic'||c.kind==='police'&&c.mode!=='chase'?c.cur:(c.vx*Math.cos(c.a)+c.vy*Math.sin(c.a));if(!c.air)c.wsp=gs;const sp=c.air?c.wsp||0:gs;for(const w of ud.wheels)w.rotation.z-=sp*dt/4.5}
    if(c.kind==='dead'&&!ud.dead){ud.dead=true;ud.body.material=M.char;if(ud.cabin)ud.cabin.material=[M.char,M.char];ud.beam.visible=false;if(ud.l1){ud.l1.material=ud.l2.material=M.dim;ud.glow.visible=false}}
    if(!ud.dead){ud.beam.visible=c.kind!=='parked';if(ud.l1){const on=Math.sin(time*16+c.siren)>0;ud.l1.material=on?M.red:M.dim;ud.l2.material=on?M.dim:M.blue;ud.glow.material=on?M.redGlow:M.blueGlow}}
  });
  // peds
  syncMap(pedMeshes,peds,p=>{if(civ(p))return new THREE.Group(); // civilians draw through instCivs; the group keeps the bark sprite
    const m=personMesh(p.shirt,p.skin,!!(p.guard||p.gang),{fem:p.fem,hair:p.hair,skirt:p.fem&&p.skirt});if(p.vendor)m.add(cartMesh());return m},(p,m)=>{
    m.visible=!far(p.x,p.y,950);if(!m.visible)return;
    const u=m.userData,sc=p.fem?.95:1,lie=p.down||p.lie;
    m.position.set(p.x,groundZ(p.x,p.y)+(lie?2.5:0),p.y);m.rotation.set(lie?Math.PI/2:0,-p.a,0);m.scale.set(sc,sc*(p.crouch>0?.6:1),sc);
    if(!civ(p)){
      if(!p.down)animPerson(m,p.ph,p.guard&&heist.alarm);
      u.gun.visible=!!(p.guard||p.gang||p.armed>0);
      if(p.hands>0)u.a1.rotation.z=u.a2.rotation.z=2.9;else if(p.calling>0||p.still&&p.kind==='phone')u.a2.rotation.z=2.4;
    }
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
    const cb=r.chatT>time;
    if(cb&&!ud.bub){ud.bub=chatBubbleSprite();g.add(ud.bub)}
    if(ud.bub){ud.bub.visible=cb;if(cb){ud.bub.position.y=r.inCar?40:34;drawChatBubble(ud.bub,r.chatLine,r.color)}}
  });
  // bullets
  syncMap(bulletMeshes,bullets,b=>{if(b.rocket){const g=new THREE.Group();g.add(new THREE.Mesh(G.rocket,M.rocket));const f=new THREE.Mesh(new THREE.PlaneGeometry(1,1),M.fire);f.scale.set(30,30,1);f.rotation.x=-Math.PI/2;f.position.x=-8;g.add(f);return g}return new THREE.Mesh(G.tracer,b.owner==='police'?M.ptracer:M.tracer)},
    (b,m)=>{m.position.set(b.x,b.z||12,b.y);m.rotation.y=-Math.atan2(b.vy,b.vx)});
  // cash
  syncMap(cashMeshes,pickups,p=>new THREE.Mesh(G.cash,M.cash),(p,m)=>{m.position.set(p.x,groundZ(p.x,p.y)+4+Math.sin(time*4+p.x)*1.5,p.y);m.rotation.y=time*2});
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
  if(jv){const col=jobCol();beacon.material.color.set(col);beaconRing.material.color.set(col);const jg=groundZ(job.x,job.y);beacon.position.set(job.x,jg+80,job.y);beaconRing.position.set(job.x,jg+1.8,job.y);beacon.material.opacity=.22+Math.sin(time*4)*.06}
  for(const r of shopRings)r.scale.setScalar(1+Math.sin(time*3)*.08);
  // chat ping beacons: 6 s each, pooled
  for(let i=chatPings.length-1;i>=0;i--)if(time-chatPings[i].t>6)chatPings.splice(i,1);
  while(pingObjs.length<chatPings.length)pingObjs.push(pingObj());
  for(let i=0;i<pingObjs.length;i++){const g=pingObjs[i],p=chatPings[i];g.visible=!!p;if(!p)continue;
    const age=time-p.t;g.position.set(p.x,groundZ(p.x,p.y),p.y);g.userData.cyl.material.color.set(p.c);g.userData.ring.material.color.set(p.c);
    g.userData.cyl.material.opacity=Math.max(0,(1-age/6)*.3);g.userData.ring.scale.setScalar(1+Math.sin(age*9)*.25);g.userData.ring.material.opacity=Math.max(.25,1-age/6)}
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
  // camera. A dead player with a living remote spectates that player in a chase view; solo (specR null)
  // keeps exactly the old camera on the body.
  const spc=state==='dead'&&specR?specR:null;
  const inCar=!!me.car,tx=spc?spc.x:inCar?me.car.x:me.x,ty=spc?spc.y:inCar?me.car.y:me.y,vh=spc?(spc.inCar?(spc.cz||0):(spc.z||0)):(inCar?me.car.z||0:me.z||0);
  if(inCar){if(time-look.offT>1.2)look.off*=Math.pow(.04,dt);const vel=Math.hypot(me.car.vx,me.car.vy),rev=(me.car.vx*Math.cos(me.car.a)+me.car.vy*Math.sin(me.car.a))<-40;
    look.yaw+=wrap(me.car.a+(rev?Math.PI:0)+look.off-look.yaw)*Math.min(1,dt*(3+vel/120))}
  else if(spc)look.yaw+=wrap(spc.a-look.yaw)*Math.min(1,dt*3);
  const dist=spc?(spc.inJet?230:spc.inHeli?150:spc.inCar?96:54):(inCar?96:me.jet?230:me.heli?150:(me.inside?42:54)),baseH=spc?(spc.inJet?60:spc.inHeli?34:spc.inCar?30:22):(inCar?30:me.jet?60:me.heli?34:(me.inside?24:22)),pitch=spc?look.pitch:(me.inside?clamp(look.pitch,-.3,.55):inCar?clamp(look.pitch,-.1,.8):look.pitch);
  const fx=Math.cos(look.yaw),fy=Math.sin(look.yaw),rx=-fy,ry=fx,veh=spc?(spc.inCar||spc.inHeli||spc.inJet):(inCar||me.heli||me.jet),side=veh?0:9;
  let k=1;for(let s=.2;s<=1.001;s+=.1){const px=tx-fx*dist*s+rx*side*s,py=ty-fy*dist*s+ry*side*s;if(solidAt(px,py,vh+baseH)){k=Math.max(.18,s-.12);break}}
  const want=new THREE.Vector3(tx-fx*dist*Math.cos(pitch)*k+rx*side*k,vh+Math.max(5,baseH+Math.sin(pitch)*dist*k),ty-fy*dist*Math.cos(pitch)*k+ry*side*k);
  want.y=Math.max(want.y,groundZ(want.x,want.z)+6);
  camPos.lerp(want,Math.min(1,dt*(veh?7:14)));
  const sh=reduced?0:shake*.6;camera.position.set(camPos.x+(rand()-.5)*sh,camPos.y+(rand()-.5)*sh,camPos.z+(rand()-.5)*sh);
  camera.lookAt(tx+fx*30+rx*side*.6,vh+(inCar?16:15)-(pitch-.2)*55,ty+fy*30+ry*side*.6);
  if(drunk>0){drunk=Math.max(0,drunk-dt);const k2=Math.min(1.8,drunk/12);camera.rotation.z+=Math.sin(time*1.7)*.08*k2;camera.position.x+=Math.sin(time*1.1)*4*k2;camera.position.y+=Math.sin(time*.9)*2*k2}
  if(scoped){const hz=(me.z||0)+19;camera.position.set(me.x+fx*6,hz,me.y+fy*6);camera.lookAt(me.x+fx*300,hz-(look.pitch-.2)*200,me.y+fy*300);meMesh.visible=false}
  if(lap){camera.position.set(club.ox+398,24,club.oy+322);camera.lookAt(club.ox+386,14,club.oy+272)}
  const fov=scoped?16:62-(drugState.k==='calm'?4:0)+(inCar?clamp(Math.hypot(me.car.vx,me.car.vy)/330,0,1)*14:0);if(Math.abs(camera.fov-fov)>.1){camera.fov+=(fov-camera.fov)*Math.min(1,dt*9);camera.updateProjectionMatrix()}
  instCivs();instCars(dt);
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
  roomFog();skyDome.position.copy(camera.position);const tg=performance.now();renderer.render(scene,camera);pf.gl=performance.now()-tg;
}

// minimap
const MS=4,MO=100,miniBig=document.createElement('canvas');miniBig.width=miniBig.height=Math.ceil((W+500)/MS);
{const g=miniBig.getContext('2d'),t=v=>(v+MO)/MS;
 g.fillStyle=MAPC.water;g.fillRect(0,0,miniBig.width,miniBig.height);
 g.fillStyle=MAPC.sand;g.fillRect(t(-30),t(W-10),(W+60)/MS,310/MS);
 g.fillStyle=MAPC.road;g.fillRect(t(0),t(0),W/MS,W/MS);
 // district tints, the two avenues, landmark blocks ringed in gold
 const BC={airport:MAPC.airport,hood:MAPC.hood,park:MAPC.park,lot:MAPC.lot,beach:MAPC.sand,front:MAPC.front,suburb:MAPC.suburb,industrial:MAPC.industrial,city:MAPC.midtown};
 for(let bj=0;bj<N;bj++)for(let bi=0;bi<N;bi++){const x=bi*B+R,y=bj*B+R,sz=B-R,tp=blockType[bj*N+bi];
   g.fillStyle=MAPC.roadEdge;g.fillRect(t(x),t(y),sz/MS,sz/MS);
   g.fillStyle=Object.values(LANDBLK).includes(tp)?MAPC.gold:district(bi,bj)==='downtown'?MAPC.downtown:(BC[tp]||MAPC.midtown);
   g.fillRect(t(x+SW),t(y+SW),(sz-2*SW)/MS,(sz-2*SW)/MS);
   if(Object.values(LANDBLK).includes(tp)){g.strokeStyle=MAPC.gold;g.lineWidth=1.5;g.strokeRect(t(x)+1,t(y)+1,sz/MS-2,sz/MS-2)}}
 g.fillStyle=MAPC.ave;for(const k of AVENUE){g.fillRect(t(k*B+40),t(0),40/MS,W/MS);g.fillRect(t(0),t(k*B+40),W/MS,40/MS)}
 // the docks canal: water with a quay casing
 {const x0=t(CANAL.x0),x1=t(CANAL.x1),y0=t(CANAL.y0),y1=t(CANAL.y1);
  g.fillStyle=MAPC.roadEdge;g.fillRect(x0-2,y0-2,x1-x0+4,y1-y0+4);
  g.fillStyle=MAPC.waterLight;g.fillRect(x0,y0,x1-x0,y1-y0);
  g.fillStyle=MAPC.roadEdge;g.fillRect(t(CANAL.bridge[0]),y0-2,(CANAL.bridge[1]-CANAL.bridge[0])/MS,y1-y0+4)}
 // the planned corridors: a light verge with the road down its middle
 for(const c of CUTS){g.lineCap='round';
  g.strokeStyle=MAPC.roadEdge;g.lineWidth=2*c.half/MS;g.beginPath();g.moveTo(t(c.ax),t(c.ay));g.lineTo(t(c.bx),t(c.by));g.stroke();
  g.strokeStyle=MAPC.ave;g.lineWidth=2*c.road/MS;g.beginPath();g.moveTo(t(c.ax),t(c.ay));g.lineTo(t(c.bx),t(c.by));g.stroke()}
 g.lineCap='butt';
 g.fillStyle=MAPC.airport;g.fillRect(t(AF.x0),t(AF.y0),(AF.x1-AF.x0)/MS,(AF.y1-AF.y0)/MS);
 g.fillStyle=MAPC.runway;g.fillRect(t(RWX-48),t(300),96/MS,2000/MS);
 g.fillStyle=MAPC.roadEdge;g.fillRect(t(RWX+60),t(300),26/MS,2130/MS);g.fillRect(t(4096),t(2430),296/MS,195/MS);
 for(const p of parks)for(const[x,y,r]of p.trees){g.fillStyle='#2f8a4e';g.beginPath();g.arc(t(x),t(y),r/MS,0,TAU);g.fill()}
 for(const b of buildings){if(b.kind==='water'){g.fillStyle='#1d6a8a';g.beginPath();g.ellipse(t(b.x+b.w/2),t(b.y+b.h/2),(b.w+30)/2/MS,(b.h+30)/2/MS,0,0,TAU);g.fill();continue}
   g.fillStyle=b.kind==='house'?b.trim:b.kind==='container'?b.roof:shade(b.roof,1.25);g.fillRect(t(b.x),t(b.y),b.w/MS,b.h/MS)}
 for(const p of pools){g.fillStyle='#2bb8e6';g.fillRect(t(p.x),t(p.y),p.w/MS,p.h/MS)}
 for(const k of RAISED){const i=k%HM.gw,j=(k/HM.gw)|0,h=HM.a[k];g.fillStyle=`rgba(255,240,220,${Math.min(.4,h/120)})`;g.fillRect(t(HM.x0+i*HM.cell),t(HM.y0+j*HM.cell),HM.cell/MS+1,HM.cell/MS+1)} // raised ground reads lighter
g.fillStyle='#6a5040';g.fillRect(t(2077),t(W+300),46/MS,520/MS);
 g.strokeStyle='rgba(255,201,74,.35)';g.lineWidth=1;g.setLineDash([3,3]);g.beginPath();for(let k=0;k<=N;k++){g.moveTo(t(0),t(k*B+60));g.lineTo(t(W),t(k*B+60));g.moveTo(t(k*B+60),t(0));g.lineTo(t(k*B+60),t(W))}g.stroke();g.setLineDash([])}
const hillMini=buildHillMini(MS,MO);
// the whole map at MS units a pixel, built once: city, hills, then the relief on top. The phone map and drawMini blit it.
const MAPB={x0:-MO,y0:HILL.edge-MO,x1:W+400,y1:W+400};
const mapBase=buildMapBase();
const DOORICON={'Pink Flamingo':'D','Ink & Fade':'T','Iron Palms':'W','Palmetto PD':'P',"St. Palm's":'+','Pixel Palace':'A','Rusty Anchor':'R','Union Bank':'B','Gun shop':'G','Velvet Palms':'V','Snack & Go':'S','Safehouse':'H','Casino':'$','Low Palms apartment':'L','Midtown condo':'M','Sunset beach house':'E','Palm Heights villa':'Y','Downtown penthouse':'N'};
let miniSc=.35;
function drawMini(){
  const c=mctx,S=300,C=150,RIM=140;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,S,S);
  c.save();c.beginPath();c.arc(C,C,148,0,TAU);c.clip();c.fillStyle='#0b2a3d';c.fillRect(0,0,S,S);
  const cx=A.x,cy=A.y,heading=me.car?me.car.a:look.yaw,rot=-heading-Math.PI/2,cs=Math.cos(rot),sn=Math.sin(rot);
  const sp=me.car?Math.hypot(me.car.vx,me.car.vy):0,want=148/(me.car?520+sp*1.3:380);miniSc+=(want-miniSc)*.06;const sc=miniSc;
  c.translate(C,C);c.rotate(rot);c.scale(sc*MS,sc*MS);c.drawImage(mapBase,(MAPB.x0-cx)/MS,(MAPB.y0-cy)/MS);c.setTransform(1,0,0,1,0,0);
  const Pt=(x,y)=>{const dx=(x-cx)*sc,dy=(y-cy)*sc;return[C+dx*cs-dy*sn,C+dx*sn+dy*cs]};
  const edge=(x,y)=>{let[px,py]=Pt(x,y);const dx=px-C,dy=py-C,d=Math.hypot(dx,dy);if(d>RIM){px=C+dx/d*RIM;py=C+dy/d*RIM;return[px,py,true]}return[px,py,false]};
  const inView=(x,y)=>{const[px,py]=Pt(x,y);return Math.hypot(px-C,py-C)<RIM+6};
  // route line to the job
  if(job&&job.phase!=='wait'&&!job.noMarker&&!me.inside){const col=jobCol(),[jx,jy]=edge(job.x,job.y);c.strokeStyle=col;c.globalAlpha=.55;c.lineWidth=3;c.setLineDash([6,6]);c.beginPath();c.moveTo(C,C);c.lineTo(jx,jy);c.stroke();c.setLineDash([]);c.globalAlpha=1}
  // waypoint: GPS line along the road grid
  if(waypoint&&!me.inside){const rt=wpRouteC(A.x,A.y,waypoint.x,waypoint.y);c.strokeStyle='#29e6d6';c.globalAlpha=.85;c.lineWidth=3;c.setLineDash([5,5]);c.beginPath();c.moveTo(...Pt(A.x,A.y));rt.forEach(([x,y])=>c.lineTo(...Pt(x,y)));c.stroke();c.setLineDash([]);c.globalAlpha=1}
  // places and spots: small icons, rings for outdoor spots, squares for enterable places
  c.font='700 11px "Chakra Petch",sans-serif';c.textAlign='center';c.textBaseline='middle';
  for(const l of LANDMARKS){const mx=l.x+l.w/2,my=l.y+l.h/2;if(!inView(mx,my))continue;const[px,py]=Pt(mx,my);mapIcon(c,px,py,6,false,'#ffc94a',l.ic)}
  for(const s of HILL_SPOTS){if(!inView(s.x,s.y))continue;const[px,py]=Pt(s.x,s.y);mapIcon(c,px,py,6,false,'#ffc94a',s.icon)}
   {const near=[];for(const d of DOORS){const dd=Math.hypot(d.x-cx,d.y-cy);if(dd<430)near.push([dd,d])}
   near.sort((a,b)=>a[0]-b[0]);
   for(const[,d]of near.slice(0,6)){if(!inView(d.x,d.y))continue;const[px,py]=Pt(d.x,d.y);mapIcon(c,px,py,6.5,true,d.col,DOORICON[d.label]||'?')}}
  {const[px,py]=edge(GARAGE.x,GARAGE.y);mapIcon(c,px,py,6,false,'#ffc94a','C')}
  for(const b of ladders){if(!inView(b.ladder.x,b.ladder.base))continue;const[px,py]=Pt(b.ladder.x,b.ladder.base);c.fillStyle='#a7a1ba';c.fillRect(px-2,py-2,4,4)}
  // armored truck
  for(const v of cars)if(v.type==='armored'&&v.kind!=='dead'&&v!==me.car){const[px,py,e]=edge(v.x,v.y);c.fillStyle='#0b0814';c.fillRect(px-9,py-9,18,18);c.strokeStyle='#ffc94a';c.lineWidth=2.5;c.strokeRect(px-9,py-9,18,18);c.fillStyle='#ffc94a';c.fillText('A',px,py+1)}
  if(heli&&!heli.dead&&me.heli!==heli){const[px,py]=edge(heli.x,heli.y);c.fillStyle='#0b0814';c.beginPath();c.arc(px,py,10,0,TAU);c.fill();c.strokeStyle='#3dff7a';c.lineWidth=2.5;c.stroke();c.beginPath();c.moveTo(px-7,py-7);c.lineTo(px+7,py+7);c.moveTo(px+7,py-7);c.lineTo(px-7,py+7);c.stroke()}
  for(const j of jets)if(!j.dead&&me.jet!==j&&inView(j.x,j.y)){const[px,py]=Pt(j.x,j.y);c.save();c.translate(px,py);c.rotate(j.a+rot);c.fillStyle='#c9d4e6';c.strokeStyle='#0b0814';c.lineWidth=1.5;c.beginPath();c.moveTo(11,0);c.lineTo(-7,9);c.lineTo(-3,0);c.lineTo(-7,-9);c.closePath();c.fill();c.stroke();c.restore()}
  // cop search circle
  if(heat>0&&lastSeen){const[px,py]=Pt(lastSeen.x,lastSeen.y);c.fillStyle='rgba(74,163,255,.25)';c.beginPath();c.arc(px,py,(220+140*Math.ceil(heat-.001))*sc,0,TAU);c.fill()}
  // cops
  for(const v of cars)if(v.kind==='police'&&inView(v.x,v.y)){const[px,py]=Pt(v.x,v.y);c.fillStyle=Math.sin(time*12+v.siren)>0?'#ff2d55':'#2d6bff';c.beginPath();c.arc(px,py,6,0,TAU);c.fill()}
  for(const v of cars)if(v.personal&&v.kind!=='dead'&&inView(v.x,v.y)){const[px,py]=Pt(v.x,v.y);c.fillStyle='#4aa3ff';c.fillRect(px-6,py-3.5,12,7)}
  for(const p of peds)if(p.gang&&!p.down&&inView(p.x,p.y)){const[px,py]=Pt(p.x,p.y);c.fillStyle=p.aggro?'#ff4b4b':p.gname==='Kings'?'#9a5ad8':'#3d9a4a';c.beginPath();c.arc(px,py,4.5,0,TAU);c.fill();c.strokeStyle='#0b0814';c.lineWidth=1.5;c.stroke()}
  // sticky bombs
  for(const b of stickies){if(!inView(b.x,b.y))continue;const[px,py]=Pt(b.x,b.y);c.fillStyle=Math.sin(time*10)>0?'#ff4b4b':'#5a1a1a';c.beginPath();c.arc(px,py,3.5,0,TAU);c.fill()}
  // race boards and the checkpoints still ahead
  for(const r of RACES)if(inView(r.board.x,r.board.y)){const[px,py]=Pt(r.board.x,r.board.y);c.fillStyle='#0b0814';c.beginPath();c.arc(px,py,8,0,TAU);c.fill();c.strokeStyle='#3dd68c';c.lineWidth=2;c.stroke();c.fillStyle='#3dd68c';c.fillText('R',px,py+1)}
  if(raceState.on)for(let k=raceState.i;k<raceState.n;k++){const q=RACES[raceState.c].p[k];if(inView(q.x,q.y)){const[px,py]=Pt(q.x,q.y);c.fillStyle='#ffc94a';c.fillRect(px-3,py-3,6,6)}}
  // job marker
  if(job&&job.phase!=='wait'&&!job.noMarker&&!me.inside){const col=jobCol(),[px,py,e]=edge(job.x,job.y);c.fillStyle=col;c.beginPath();c.arc(px,py,e?7:9,0,TAU);c.fill();c.strokeStyle='#0b0814';c.lineWidth=2;c.stroke()}
  // mission marker and contact icons
  if(mission){const w=msWhere();if(w&&!me.inside){const[px,py,e]=edge(w[0],w[1]);c.strokeStyle=mission.def.col;c.globalAlpha=.5;c.lineWidth=3;c.setLineDash([6,6]);c.beginPath();c.moveTo(C,C);c.lineTo(px,py);c.stroke();c.setLineDash([]);c.globalAlpha=1;
    c.fillStyle=mission.def.col;c.beginPath();c.arc(px,py,e?7:9,0,TAU);c.fill();c.strokeStyle='#0b0814';c.lineWidth=2;c.stroke()}}
  for(const q of MCON){const[px,py]=edge(q.x,q.y);c.fillStyle='#0b0814';c.beginPath();c.arc(px,py,10,0,TAU);c.fill();c.strokeStyle=q.col;c.lineWidth=2.5;c.stroke();c.fillStyle=q.col;c.fillText(q.short,px,py+1)}
  // waypoint pin
  if(waypoint&&!me.inside){const[px,py,e]=edge(waypoint.x,waypoint.y);c.fillStyle='#29e6d6';c.beginPath();c.arc(px,py,e?6:8,0,TAU);c.fill();c.strokeStyle='#0b0814';c.lineWidth=2;c.stroke()}
  // friends
  for(const r of remotes.values()){if(r.dead)continue;const[px,py,e]=edge(r.x,r.y);c.save();c.translate(px,py);c.rotate(r.a+rot);c.fillStyle=r.color;c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.moveTo(9,0);c.lineTo(-6,6);c.lineTo(-6,-6);c.closePath();c.fill();c.stroke();c.restore()}
  // chat ping markers: a pulsing ring in the peer colour for 6 s
  for(const p of chatPings){const[px,py,e]=edge(p.x,p.y),age=time-p.t;c.strokeStyle=p.c;c.globalAlpha=Math.max(.2,1-age/6);c.lineWidth=3;c.beginPath();c.arc(px,py,(e?8:10)*(1+Math.sin(age*9)*.3),0,TAU);c.stroke();c.globalAlpha=1;c.fillStyle=p.c;c.beginPath();c.arc(px,py,3.5,0,TAU);c.fill()}
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
