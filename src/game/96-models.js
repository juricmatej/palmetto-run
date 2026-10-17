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
  add(box(.8,1,C.hwAt(P.tF)*1.7),trimM,L*(P.tF-.5)-.6,P.belt+.5,0); // windscreen band
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
const HAIRC=['#1a120c','#3a2416','#6a4a22','#c9a24a','#111111','#7a2f3a','#e8d9b0','#b8482a'];
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
// chat bubble above a remote: one sprite per remote, its canvas is redrawn only when the phrase or the colour changes
function chatBubbleSprite(){const c=document.createElement('canvas');c.width=256;c.height=64;const t=new THREE.CanvasTexture(c);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false}));s.scale.set(44,11,1);s.position.y=34;s.renderOrder=10;s.userData={c,t,k:''};return s}
function drawChatBubble(s,v,col){const k=v+col;if(s.userData.k===k)return;s.userData.k=k;const g=s.userData.c.getContext('2d');g.clearRect(0,0,256,64);
  g.font='700 24px "Chakra Petch", sans-serif';g.textAlign='center';g.textBaseline='middle';const w=Math.min(248,g.measureText(v).width+24);
  g.fillStyle='rgba(10,8,20,.82)';g.fillRect(128-w/2,8,w,48);g.strokeStyle=col;g.lineWidth=2;g.strokeRect(128-w/2,8,w,48);g.fillStyle=col;g.fillText(v,128,33);s.userData.t.needsUpdate=true}
// chat ping beacon: the job beacon look in the peer colour, pooled and reused
const pingObjs=[];
function pingObj(){const g=new THREE.Group();const cyl=new THREE.Mesh(new THREE.CylinderGeometry(9,9,90,16,1,true),new THREE.MeshBasicMaterial({color:'#fff',transparent:true,opacity:.26,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));cyl.position.y=45;
  const ring=new THREE.Mesh(new THREE.RingGeometry(9,12,28),new THREE.MeshBasicMaterial({color:'#fff',transparent:true,opacity:.9,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=1.6;g.add(cyl,ring);g.userData.cyl=cyl;g.userData.ring=ring;scene.add(g);return g}

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
